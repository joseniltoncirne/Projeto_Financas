import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth.middleware.js'
import { balanceRepository } from '../repositories/balance.repository.js'
import { upsertBalanceSchema, listBalancesSchema } from '../schemas/balance.schema.js'

export async function balanceRoutes(app: FastifyInstance) {
  // GET /api/balances?month=
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const { month } = listBalancesSchema.parse(request.query)
    const balances = await balanceRepository.findMany(userId, month)
    return reply.send(balances)
  })

  // PUT /api/balances (upsert)
  app.put('/', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const { month, bank, value } = upsertBalanceSchema.parse(request.body)
    const balance = await balanceRepository.upsert(userId, month, bank, value)
    return reply.send(balance)
  })
}
