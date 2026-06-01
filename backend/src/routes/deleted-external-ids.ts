import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth.middleware.js'
import { deletedExternalIdRepository } from '../repositories/deletedExternalId.repository.js'
import { prisma } from '../lib/prisma.js'
import { ClassifierService } from '../services/classifier.service.js'

export async function deletedExternalIdRoutes(app: FastifyInstance) {
  // GET /api/deleted-external-ids — lista histórico de excluídos do usuário
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const items = await deletedExternalIdRepository.findByUser(userId)
    return reply.send(items)
  })

  // DELETE /api/deleted-external-ids/:id — restaura: remove tombstone e recria o gasto imediatamente
  app.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const { id } = request.params as { id: string }

    const tombstone = await prisma.deletedExternalId.findFirst({ where: { id, userId } })
    if (!tombstone) {
      return reply.status(404).send({ statusCode: 404, message: 'Registro não encontrado' })
    }

    // Remove tombstone
    await prisma.deletedExternalId.deleteMany({ where: { id, userId } })

    // Recria o gasto imediatamente com os dados do tombstone
    if (tombstone.kind === 'expense') {
      const [rules, amountRules] = await Promise.all([
        prisma.rule.findMany({ where: { userId } }),
        prisma.amountRule.findMany({ where: { userId } }),
      ])
      const ruleMap = new Map(rules.map(r => [r.memo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''), r.category]))
      const amountRuleMap = new Map(
        amountRules.map(r => [`${ClassifierService.normalizeKey(r.normalizedName)}::${Number(r.amount).toFixed(2)}`, r.category]),
      )
      const category = ClassifierService.category(tombstone.name, tombstone.amount, ruleMap, amountRuleMap)

      await prisma.expense.create({
        data: {
          userId,
          month: tombstone.month,
          name: tombstone.name,
          amount: tombstone.amount,
          bank: tombstone.bank,
          dateStr: tombstone.dateStr,
          externalId: tombstone.externalId,
          sector: 'gasto',
          type: 'variavel',
          category,
        },
      })
    }

    return reply.status(204).send()
  })
}
