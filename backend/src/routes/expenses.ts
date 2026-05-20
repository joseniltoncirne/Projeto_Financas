import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth.middleware.js'
import { expenseRepository } from '../repositories/expense.repository.js'
import {
  createExpenseSchema,
  updateExpenseSchema,
  listExpensesSchema,
  bulkClearExpensesSchema,
} from '../schemas/expense.schema.js'

export async function expenseRoutes(app: FastifyInstance) {
  // GET /api/expenses?month=&bank=&sector=
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const query = listExpensesSchema.parse(request.query)
    const expenses = await expenseRepository.findMany(userId, query)
    return reply.send(expenses)
  })

  // POST /api/expenses
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const data = createExpenseSchema.parse(request.body)
    const expense = await expenseRepository.create(userId, data)
    return reply.status(201).send(expense)
  })

  // PATCH /api/expenses/:id
  app.patch('/:id', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const { id } = request.params as { id: string }
    const data = updateExpenseSchema.parse(request.body)
    const result = await expenseRepository.update(id, userId, data)
    if (result.count === 0) {
      return reply.status(404).send({ statusCode: 404, message: 'Despesa não encontrada' })
    }
    const updated = await expenseRepository.findById(id, userId)
    return reply.send(updated)
  })

  // DELETE /api/expenses/:id
  app.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const { id } = request.params as { id: string }
    const result = await expenseRepository.delete(id, userId)
    if (result.count === 0) {
      return reply.status(404).send({ statusCode: 404, message: 'Despesa não encontrada' })
    }
    return reply.status(204).send()
  })

  // DELETE /api/expenses?month=&bank= (bulk clear)
  app.delete('/', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const { month, bank } = bulkClearExpensesSchema.parse(request.query)
    await expenseRepository.deleteByMonthAndBank(userId, month, bank)
    return reply.status(204).send()
  })
}
