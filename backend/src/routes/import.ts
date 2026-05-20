import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth.middleware.js'
import { importService } from '../services/import.service.js'
import { bulkImportSchema } from '../schemas/import.schema.js'

export async function importRoutes(app: FastifyInstance) {
  // POST /api/import
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const input = bulkImportSchema.parse(request.body)
    const result = await importService.bulkImport(userId, input)
    return reply.status(201).send(result)
  })
}
