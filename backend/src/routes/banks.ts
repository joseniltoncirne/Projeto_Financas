import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth.middleware.js'
import { incomeRepository } from '../repositories/income.repository.js'
import { expenseRepository } from '../repositories/expense.repository.js'

const BANK_ORDER = [
  'nubank', 'inter', 'caixa', 'itau', 'bradesco',
  'santander', 'bb', 'stone', 'original', 'generico',
]

export async function bankRoutes(app: FastifyInstance) {
  // GET /api/banks — lista bancos que têm pelo menos uma transação
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub

    const [incomeBanks, expenseBanks] = await Promise.all([
      incomeRepository.distinctBanks(userId),
      expenseRepository.distinctBanks(userId),
    ])

    const all = new Set([
      ...incomeBanks.map(r => r.bank),
      ...expenseBanks.map(r => r.bank),
    ])

    const sorted = BANK_ORDER.filter(b => all.has(b))
    const others = [...all].filter(b => !BANK_ORDER.includes(b)).sort()

    return reply.send([...sorted, ...others])
  })
}
