import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth.middleware.js'
import { ruleRepository, amountRuleRepository } from '../repositories/rule.repository.js'
import {
  upsertRuleSchema,
  upsertAmountRuleSchema,
  deleteAmountRuleSchema,
} from '../schemas/rule.schema.js'

export async function ruleRoutes(app: FastifyInstance) {
  // GET /api/rules
  app.get('/rules', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    return reply.send(await ruleRepository.findAll(userId))
  })

  // PUT /api/rules (upsert)
  app.put('/rules', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const { memo, category } = upsertRuleSchema.parse(request.body)
    const rule = await ruleRepository.upsert(userId, memo, category)
    return reply.send(rule)
  })

  // GET /api/amount-rules
  app.get('/amount-rules', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    return reply.send(await amountRuleRepository.findAll(userId))
  })

  // PUT /api/amount-rules (upsert)
  app.put('/amount-rules', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const { normalizedName, amount, category } = upsertAmountRuleSchema.parse(request.body)
    const rule = await amountRuleRepository.upsert(userId, normalizedName, amount, category)
    return reply.send(rule)
  })

  // DELETE /api/amount-rules?normalizedName=&amount=
  app.delete('/amount-rules', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const { normalizedName, amount } = deleteAmountRuleSchema.parse(request.query)
    await amountRuleRepository.delete(userId, normalizedName, amount)
    return reply.status(204).send()
  })
}
