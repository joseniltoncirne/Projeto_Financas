import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth.middleware.js'
import { categoryRepository } from '../repositories/category.repository.js'
import { createCategorySchema, updateCategorySchema } from '../schemas/category.schema.js'
import { prisma } from '../lib/prisma.js'

function toCategoryKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

export async function categoryRoutes(app: FastifyInstance) {
  // GET /api/categories
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    return reply.send(await categoryRepository.findAll(userId))
  })

  // POST /api/categories
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const data = createCategorySchema.parse(request.body)

    const existing = await categoryRepository.findByKey(userId, data.key)
    if (existing) {
      return reply.status(409).send({ statusCode: 409, message: 'Categoria já existe' })
    }

    const category = await categoryRepository.create(userId, data)
    return reply.status(201).send(category)
  })

  // PATCH /api/categories/:key
  app.patch('/:key', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const { key } = request.params as { key: string }
    const data = updateCategorySchema.parse(request.body)

    if (data.label) {
      const category = await categoryRepository.findByKey(userId, key)
      if (category?.isFixed) {
        const plainLabel = data.label.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]\s*/u, '').trim()
        const newKey = toCategoryKey(plainLabel)

        const fixedExpenses = await prisma.fixedExpense.findMany({ where: { userId, active: true } })
        const match = fixedExpenses.find(fe => toCategoryKey(fe.name) === key)

        if (newKey !== key) {
          // O slug mudou — migração completa de chave
          await prisma.category.upsert({
            where: { userId_key: { userId, key: newKey } },
            create: { userId, key: newKey, label: data.label, isFixed: true },
            update: { label: data.label, isFixed: true },
          })
          await prisma.expense.updateMany({
            where: { userId, category: key },
            data: { category: newKey },
          })
          if (match) {
            await prisma.fixedExpense.update({
              where: { id: match.id },
              data: { name: plainLabel },
            })
            await prisma.expense.updateMany({
              where: { userId, externalId: { startsWith: `fixed:${match.id}:` } },
              data: { name: plainLabel, category: newKey },
            })
          }
          await prisma.category.deleteMany({ where: { userId, key, isFixed: true } })
          return reply.send(await categoryRepository.findByKey(userId, newKey))
        }

        // Mesmo slug — só atualiza label e nome do gasto fixo
        await categoryRepository.update(userId, key, data)
        if (match) {
          await prisma.fixedExpense.update({
            where: { id: match.id },
            data: { name: plainLabel },
          })
          await prisma.expense.updateMany({
            where: { userId, externalId: { startsWith: `fixed:${match.id}:` } },
            data: { name: plainLabel },
          })
        }
        return reply.send(await categoryRepository.findByKey(userId, key))
      }
    }

    const result = await categoryRepository.update(userId, key, data)
    if (result.count === 0) {
      // Categoria ainda não existe no banco (é padrão do sistema) — cria com os dados enviados
      const created = await prisma.category.create({
        data: { userId, key, label: key, ...data },
      })
      return reply.send(created)
    }
    return reply.send(await categoryRepository.findByKey(userId, key))
  })

  // DELETE /api/categories/:key
  // Cleanup completo: migra gastos para 'outros', remove regras e a categoria.
  // Rejeita categorias de gastos fixos (devem ser removidas via /api/fixed-expenses).
  app.delete('/:key', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const { key } = request.params as { key: string }

    if (key === 'outros') {
      return reply.status(400).send({ statusCode: 400, message: 'A categoria padrão "Outros" não pode ser removida' })
    }

    const category = await categoryRepository.findByKey(userId, key)
    if (category?.isFixed) {
      return reply.status(400).send({
        statusCode: 400,
        message: 'Esta categoria está vinculada a um gasto fixo. Remova o gasto fixo primeiro em "Minhas Contas".',
      })
    }

    await prisma.$transaction([
      prisma.expense.updateMany({
        where: { userId, category: key },
        data: { category: 'outros' },
      }),
      prisma.rule.deleteMany({ where: { userId, category: key } }),
      prisma.amountRule.deleteMany({ where: { userId, category: key } }),
      prisma.category.deleteMany({ where: { userId, key } }),
    ])

    return reply.status(204).send()
  })
}
