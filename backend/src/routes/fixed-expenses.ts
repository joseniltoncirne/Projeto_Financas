import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middleware/auth.middleware.js'
import { prisma } from '../lib/prisma.js'
import { autoLinkFixedExpenses } from '../services/import.service.js'

function normalizeTrigger(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const createSchema = z.object({
  name: z.string().min(1),
  amount: z.number().positive().optional(),
  endMonth: z.string().regex(/^\d{4}-\d{2}$/).optional().nullable(),
})

const paymentSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  expenseId: z.string().uuid().optional().nullable(),
  bank: z.string().optional(),
})

function toCategoryKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

// Padrão de externalId para gastos gerados automaticamente pelo checklist
function fixedExternalId(fixedExpenseId: string, month: string) {
  return `fixed:${fixedExpenseId}:${month}`
}

export async function fixedExpenseRoutes(app: FastifyInstance) {
  // GET /api/fixed-expenses?month=YYYY-MM
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const { month } = (request.query as { month?: string })

    // Limite superior: só contas criadas até o final do mês consultado
    const createdBefore = month
      ? new Date(`${month}-01T00:00:00.000Z`)
      : undefined
    if (createdBefore) createdBefore.setMonth(createdBefore.getMonth() + 1)

    // Retorna contas ativas criadas até o mês (e não encerradas antes) + contas inativas com pagamento no mês (histórico)
    const items = await prisma.fixedExpense.findMany({
      where: {
        userId,
        ...(createdBefore ? { createdAt: { lt: createdBefore } } : {}),
        OR: [
          {
            active: true,
            ...(month ? { OR: [{ endMonth: null }, { endMonth: { gte: month } }] } : {}),
          },
          ...(month ? [{ active: false, payments: { some: { month } } }] : []),
        ],
      },
      include: { payments: true },
      orderBy: { createdAt: 'asc' },
    })
    return reply.send(items)
  })

  // POST /api/fixed-expenses
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const { name, amount, endMonth } = createSchema.parse(request.body)
    const item = await prisma.fixedExpense.create({
      data: { userId, name, amount, endMonth: endMonth ?? null },
      include: { payments: true },
    })
    return reply.status(201).send(item)
  })

  // PUT /api/fixed-expenses/:id
  app.put('/:id', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const { id } = request.params as { id: string }
    const { name, amount, endMonth } = createSchema.parse(request.body)

    const existing = await prisma.fixedExpense.findFirst({ where: { id, userId } })
    if (!existing) return reply.status(404).send({ message: 'Não encontrado' })

    const oldKey = toCategoryKey(existing.name)
    const newKey = toCategoryKey(name)

    if (oldKey === newKey) {
      // Só atualiza o label da categoria
      await prisma.category.updateMany({
        where: { userId, key: oldKey },
        data: { label: name },
      })
    } else {
      // Cria nova categoria com novo key
      await prisma.category.upsert({
        where: { userId_key: { userId, key: newKey } },
        create: { userId, key: newKey, label: name, isFixed: true },
        update: { label: name, isFixed: true },
      })
      // Migra todos os gastos que usavam a categoria antiga
      await prisma.expense.updateMany({
        where: { userId, category: oldKey },
        data: { category: newKey },
      })
      // Remove a categoria antiga
      await prisma.category.deleteMany({ where: { userId, key: oldKey } })
    }

    // Atualiza também o nome nos gastos placeholder
    await prisma.expense.updateMany({
      where: { userId, externalId: { startsWith: `fixed:${id}:` } },
      data: { name, category: newKey },
    })

    await prisma.fixedExpense.updateMany({
      where: { id, userId },
      data: { name, amount, endMonth: endMonth ?? null },
    })
    return reply.send({ ok: true })
  })

  // DELETE /api/fixed-expenses/:id
  app.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const { id } = request.params as { id: string }

    const fixedExpense = await prisma.fixedExpense.findFirst({ where: { id, userId } })
    if (!fixedExpense) return reply.status(204).send()

    const categoryKey = toCategoryKey(fixedExpense.name)
    const currentMonth = new Date().toISOString().slice(0, 7)

    // Apaga apenas placeholders do mês atual em diante — meses passados são histórico
    const futurePlaceholders = await prisma.expense.findMany({
      where: { userId, externalId: { startsWith: `fixed:${id}:` } },
      select: { id: true, externalId: true },
    })
    const toDelete = futurePlaceholders
      .filter(e => e.externalId!.slice(`fixed:${id}:`.length) >= currentMonth)
      .map(e => e.id)
    if (toDelete.length) {
      await prisma.expense.deleteMany({ where: { id: { in: toDelete } } })
    }

    // Reverte gastos reais do mês atual em diante para variavel e apaga FixedExpensePayments
    const futurePayments = await prisma.fixedExpensePayment.findMany({
      where: { fixedExpenseId: id, month: { gte: currentMonth } },
      select: { id: true, expenseId: true },
    })
    const realExpenseIds = futurePayments.map(p => p.expenseId).filter(Boolean) as string[]
    if (realExpenseIds.length) {
      await prisma.expense.updateMany({
        where: { id: { in: realExpenseIds }, userId, NOT: { externalId: { startsWith: 'fixed:' } } },
        data: { type: 'variavel', category: 'outros' },
      })
    }
    // Apaga os FixedExpensePayment do mês atual em diante — past months ficam para histórico
    if (futurePayments.length) {
      await prisma.fixedExpensePayment.deleteMany({
        where: { id: { in: futurePayments.map(p => p.id) } },
      })
    }

    // Remove a categoria fixa
    await prisma.category.deleteMany({ where: { userId, key: categoryKey, isFixed: true } })

    await prisma.fixedExpense.updateMany({
      where: { id, userId },
      data: { active: false },
    })
    return reply.status(204).send()
  })

  // POST /api/fixed-expenses/:id/payment
  app.post('/:id/payment', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const { id } = request.params as { id: string }
    const { month, expenseId, bank } = paymentSchema.parse(request.body)

    const fixedExpense = await prisma.fixedExpense.findFirst({ where: { id, userId } })
    if (!fixedExpense) return reply.status(404).send({ message: 'Não encontrado' })

    const categoryKey = toCategoryKey(fixedExpense.name)

    // Garante que a categoria existe e está marcada como fixa
    await prisma.category.upsert({
      where: { userId_key: { userId, key: categoryKey } },
      create: { userId, key: categoryKey, label: fixedExpense.name, isFixed: true },
      update: { isFixed: true },
    })

    let finalExpenseId: string | null = expenseId ?? null

    if (finalExpenseId) {
      // Se havia um placeholder auto-criado para este mês, deletá-lo antes de vincular o real
      await prisma.expense.deleteMany({
        where: { userId, externalId: fixedExternalId(id, month) },
      })
      // Vincula categoria e marca como fixo
      await prisma.expense.updateMany({
        where: { id: finalExpenseId, userId },
        data: { category: categoryKey, type: 'fixo' },
      })

      // Aprende o nome da transação para auto-vincular em meses futuros
      const linkedExpense = await prisma.expense.findFirst({
        where: { id: finalExpenseId, userId },
        select: { name: true },
      })
      if (linkedExpense && !fixedExpense.autoLinkName) {
        await prisma.fixedExpense.update({
          where: { id },
          data: { autoLinkName: normalizeTrigger(linkedExpense.name) },
        })
        // Tenta auto-vincular em meses onde já existam transações
        autoLinkFixedExpenses(userId, [month]).catch(() => {})
      }
    } else {
      // Cria gasto placeholder — marcado com externalId para identificação futura
      const externalId = fixedExternalId(id, month)
      const existing = await prisma.expense.findFirst({ where: { userId, externalId } })
      if (existing) {
        finalExpenseId = existing.id
      } else {
        const created = await prisma.expense.create({
          data: {
            userId,
            month,
            name: fixedExpense.name,
            amount: fixedExpense.amount ?? 0,
            type: 'fixo',
            category: categoryKey,
            sector: 'gasto',
            bank: bank || 'generico',
            externalId,
          },
        })
        finalExpenseId = created.id
      }
    }

    const payment = await prisma.fixedExpensePayment.upsert({
      where: { fixedExpenseId_month: { fixedExpenseId: id, month } },
      create: { fixedExpenseId: id, month, expenseId: finalExpenseId, autoCreated: !expenseId },
      update: { expenseId: finalExpenseId, autoCreated: !expenseId },
    })

    return reply.send(payment)
  })

  // DELETE /api/fixed-expenses/:id/payment/:month
  app.delete('/:id/payment/:month', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const { id, month } = request.params as { id: string; month: string }

    const fixedExpense = await prisma.fixedExpense.findFirst({ where: { id, userId } })
    if (!fixedExpense) return reply.status(404).send({ message: 'Não encontrado' })

    // Apaga o gasto placeholder (auto-criado)
    await prisma.expense.deleteMany({
      where: { userId, externalId: fixedExternalId(id, month) },
    })

    // Restaura type='variavel' em gastos reais que foram vinculados (exclui apenas placeholders 'fixed:...')
    const payment = await prisma.fixedExpensePayment.findFirst({
      where: { fixedExpenseId: id, month },
    })
    if (payment?.expenseId) {
      await prisma.expense.updateMany({
        where: {
          id: payment.expenseId,
          userId,
          NOT: { externalId: { startsWith: 'fixed:' } },
        },
        data: { type: 'variavel', category: 'outros' },
      })
    }

    await prisma.fixedExpensePayment.deleteMany({
      where: { fixedExpenseId: id, month },
    })

    return reply.status(204).send()
  })
}
