import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth.middleware.js'
import { categoryRepository } from '../repositories/category.repository.js'
import { createCategorySchema, updateCategorySchema } from '../schemas/category.schema.js'

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
    const result = await categoryRepository.update(userId, key, data)
    if (result.count === 0) {
      return reply.status(404).send({ statusCode: 404, message: 'Categoria não encontrada' })
    }
    return reply.send(await categoryRepository.findByKey(userId, key))
  })

  // DELETE /api/categories/:key
  app.delete('/:key', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const { key } = request.params as { key: string }
    await categoryRepository.delete(userId, key)
    return reply.status(204).send()
  })
}
