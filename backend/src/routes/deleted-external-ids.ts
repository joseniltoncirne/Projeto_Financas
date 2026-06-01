import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth.middleware.js'
import { deletedExternalIdRepository } from '../repositories/deletedExternalId.repository.js'

export async function deletedExternalIdRoutes(app: FastifyInstance) {
  // GET /api/deleted-external-ids — lista histórico de excluídos do usuário
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const items = await deletedExternalIdRepository.findByUser(userId)
    return reply.send(items)
  })

  // DELETE /api/deleted-external-ids/:id — restaura (remove tombstone, próximo sync re-importa)
  app.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const { id } = request.params as { id: string }
    const result = await deletedExternalIdRepository.restore(userId, id)
    if (result.count === 0) {
      return reply.status(404).send({ statusCode: 404, message: 'Registro não encontrado' })
    }
    return reply.status(204).send()
  })
}
