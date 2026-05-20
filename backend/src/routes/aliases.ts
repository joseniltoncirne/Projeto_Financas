import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth.middleware.js'
import { aliasRepository } from '../repositories/alias.repository.js'
import { upsertAliasSchema, deleteAliasSchema } from '../schemas/alias.schema.js'

export async function aliasRoutes(app: FastifyInstance) {
  // GET /api/aliases
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    return reply.send(await aliasRepository.findAll(userId))
  })

  // PUT /api/aliases (upsert)
  app.put('/', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const { normalizedName, alias } = upsertAliasSchema.parse(request.body)
    const result = await aliasRepository.upsert(userId, normalizedName, alias)
    return reply.send(result)
  })

  // DELETE /api/aliases?normalizedName=...
  app.delete('/', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const { normalizedName } = deleteAliasSchema.parse(request.query)
    await aliasRepository.delete(userId, normalizedName)
    return reply.status(204).send()
  })
}
