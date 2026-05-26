import { prisma } from '../lib/prisma.js'
import type { BulkImportInput } from '../schemas/import.schema.js'
import type { MappedTransaction } from './sync.service.js'
import { ClassifierService } from './classifier.service.js'

function normalizeTrigger(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toCategoryKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

// Verifica transações de um mês e vincula automaticamente às contas fixas com autoLinkName
export async function autoLinkFixedExpenses(userId: string, months: string[]): Promise<void> {
  const fixedExpenses = await prisma.fixedExpense.findMany({
    where: { userId, active: true, autoLinkName: { not: null } },
    include: { payments: { where: { month: { in: months } } } },
  })

  if (!fixedExpenses.length) return

  for (const month of months) {
    const fesForMonth = fixedExpenses.filter(fe =>
      // Só aplica se não tem encerramento antes deste mês
      (!fe.endMonth || fe.endMonth >= month) &&
      // E ainda não tem pagamento neste mês
      !fe.payments.some(p => p.month === month)
    )
    if (!fesForMonth.length) continue

    const expenses = await prisma.expense.findMany({
      where: { userId, month, sector: 'gasto' },
      select: { id: true, name: true, externalId: true },
    })

    for (const fe of fesForMonth) {
      const trigger = fe.autoLinkName!
      const match = expenses.find(e =>
        // Exclui placeholders gerados pelo próprio sistema
        !(e.externalId?.startsWith('fixed:')) &&
        normalizeTrigger(e.name).includes(trigger)
      )
      if (!match) continue

      const categoryKey = toCategoryKey(fe.name)

      await prisma.$transaction([
        prisma.fixedExpensePayment.upsert({
          where: { fixedExpenseId_month: { fixedExpenseId: fe.id, month } },
          create: { fixedExpenseId: fe.id, month, expenseId: match.id, autoCreated: false },
          update: { expenseId: match.id, autoCreated: false },
        }),
        prisma.expense.update({
          where: { id: match.id },
          data: { type: 'fixo', category: categoryKey },
        }),
      ])
    }
  }
}

export const importService = {
  async bulkImport(userId: string, input: BulkImportInput) {
    const { transactions, bank, saldoFinal, saldoMonth } = input

    const incomes = transactions
      .filter(t => t.isIncome)
      .map(t => ({
        userId,
        month: t.month,
        name: t.name,
        amount: t.amount,
        bank: t.bank ?? bank,
        dateStr: t.dateStr ?? null,
      }))

    const expenses = transactions
      .filter(t => !t.isIncome)
      .map(t => ({
        userId,
        month: t.month,
        name: t.name,
        amount: t.amount,
        type: t.type,
        category: t.category ?? null,
        sector: t.sector,
        bank: t.bank ?? bank,
        isResgate: t.isResgate,
        isInternal: t.isInternal,
        dateStr: t.dateStr ?? null,
      }))

    await prisma.$transaction(async tx => {
      if (incomes.length) await tx.income.createMany({ data: incomes })
      if (expenses.length) await tx.expense.createMany({ data: expenses })
      if (saldoFinal !== undefined && saldoMonth) {
        await tx.balance.upsert({
          where: { userId_month_bank: { userId, month: saldoMonth, bank } },
          create: { userId, month: saldoMonth, bank, value: saldoFinal },
          update: { value: saldoFinal },
        })
      }
    })

    // Auto-vincula contas fixas para os meses importados
    const months = [...new Set(transactions.map(t => t.month))]
    autoLinkFixedExpenses(userId, months).catch(() => {})

    return { imported: transactions.length }
  },

  async bulkImportExternal(
    userId: string,
    transactions: MappedTransaction[],
    bank: string,
  ): Promise<{ synced: number }> {
    if (!transactions.length) return { synced: 0 }

    // Coleta externalIds já existentes para este usuário
    const [existingIncome, existingExpense] = await Promise.all([
      prisma.income.findMany({
        where: { userId, externalId: { not: null } },
        select: { externalId: true },
      }),
      prisma.expense.findMany({
        where: { userId, externalId: { not: null } },
        select: { externalId: true },
      }),
    ])

    const seenIds = new Set<string>([
      ...existingIncome.map(r => r.externalId!),
      ...existingExpense.map(r => r.externalId!),
    ])

    // Remove duplicatas
    const newTxs = transactions.filter(t => !seenIds.has(t.externalId))
    if (!newTxs.length) return { synced: 0 }

    // Carrega regras de categorização do usuário
    const [rules, amountRules] = await Promise.all([
      prisma.rule.findMany({ where: { userId } }),
      prisma.amountRule.findMany({ where: { userId } }),
    ])

    const ruleMap = new Map(rules.map(r => [r.memo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''), r.category]))
    const amountRuleMap = new Map(
      amountRules.map(r => [`${ClassifierService.normalizeKey(r.normalizedName)}::${Number(r.amount).toFixed(2)}`, r.category]),
    )

    const incomes = newTxs
      .filter(t => t.isIncome)
      .map(t => ({
        userId,
        month: t.month,
        name: t.name,
        amount: t.amount,
        bank,
        dateStr: t.dateStr,
        externalId: t.externalId,
      }))

    const expenses = newTxs
      .filter(t => !t.isIncome)
      .map(t => ({
        userId,
        month: t.month,
        name: t.name,
        amount: t.amount,
        type: t.type,
        category: t.category ?? ClassifierService.category(t.name, t.amount, ruleMap, amountRuleMap),
        sector: t.sector,
        bank,
        isResgate: t.isResgate,
        isInternal: t.isInternal,
        dateStr: t.dateStr,
        externalId: t.externalId,
      }))

    await prisma.$transaction(async tx => {
      if (incomes.length) await tx.income.createMany({ data: incomes })
      if (expenses.length) await tx.expense.createMany({ data: expenses })
    })

    // Auto-vincula contas fixas para os meses sincronizados
    const months = [...new Set(newTxs.map(t => t.month))]
    autoLinkFixedExpenses(userId, months).catch(() => {})

    return { synced: newTxs.length }
  },
}
