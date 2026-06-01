import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth.middleware.js'
import { incomeRepository } from '../repositories/income.repository.js'
import { deletedExternalIdRepository } from '../repositories/deletedExternalId.repository.js'
import {
  createIncomeSchema,
  listIncomesSchema,
  bulkClearIncomesSchema,
} from '../schemas/income.schema.js'

export async function incomeRoutes(app: FastifyInstance) {
  // GET /api/incomes?month=&bank=
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const query = listIncomesSchema.parse(request.query)
    const incomes = await incomeRepository.findMany(userId, query)
    return reply.send(incomes)
  })

  // POST /api/incomes
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const data = createIncomeSchema.parse(request.body)
    const income = await incomeRepository.create(userId, data)
    return reply.status(201).send(income)
  })

  // DELETE /api/incomes/:id
  // Quando a renda veio do sync (tem externalId), registra tombstone para evitar re-import.
  app.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const { id } = request.params as { id: string }
    const income = await incomeRepository.findById(id, userId)
    if (!income) {
      return reply.status(404).send({ statusCode: 404, message: 'Receita não encontrada' })
    }
    const result = await incomeRepository.delete(id, userId)
    if (result.count === 0) {
      return reply.status(404).send({ statusCode: 404, message: 'Receita não encontrada' })
    }
    if (income.externalId) {
      await deletedExternalIdRepository.insert({
        userId,
        externalId: income.externalId,
        kind: 'income',
        name: income.name,
        amount: income.amount,
        bank: income.bank,
        dateStr: income.dateStr,
        month: income.month,
      })
    }
    return reply.status(204).send()
  })

  // DELETE /api/incomes?month=&bank= (bulk clear)
  app.delete('/', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const { month, bank } = bulkClearIncomesSchema.parse(request.query)
    await incomeRepository.deleteByMonthAndBank(userId, month, bank)
    return reply.status(204).send()
  })
}
