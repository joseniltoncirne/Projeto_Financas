import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth.middleware.js'
import { connectionRepository } from '../repositories/connection.repository.js'
import { PluggyService } from '../services/pluggy.service.js'
import { SyncService } from '../services/sync.service.js'
import { saveConnectionSchema } from '../schemas/connection.schema.js'
import { prisma } from '../lib/prisma.js'

export async function connectionRoutes(app: FastifyInstance) {
  // GET /api/connections
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const connections = await connectionRepository.findByUserId(userId)
    return reply.send(connections)
  })

  // POST /api/connections/token — gera connectToken para o widget Pluggy
  // Rate limit por usuário (cada chamada consome quota Pluggy, evita loop/abuso)
  app.post('/token', {
    preHandler: authenticate,
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 hour',
        keyGenerator: (req) => (req.user as { sub: string })?.sub ?? req.ip,
      },
    },
  }, async (request, reply) => {
    const token = await PluggyService.createConnectToken()
    return reply.send({ connectToken: token })
  })

  // POST /api/connections — salva conexão após widget retornar itemId
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const { itemId, connectorName } = saveConnectionSchema.parse(request.body)

    // Verifica se já existe
    const existing = await connectionRepository.findByItemId(itemId)
    if (existing) {
      if (existing.userId !== userId) {
        return reply.status(409).send({ statusCode: 409, message: 'Conexão já pertence a outro usuário' })
      }
      // Já existe para este usuário — apenas sincroniza
      const result = await SyncService.syncItem(userId, itemId)
      return reply.send({ ...existing, synced: result.synced })
    }

    // Detecta o banco pelo nome do conector
    let bank = 'generico'
    if (connectorName) {
      bank = PluggyService.mapBank(connectorName)
    } else {
      try {
        const item = await PluggyService.getItem(itemId)
        bank = PluggyService.mapBank(item.connector.name)
      } catch {
        // ignora erro de detecção de banco, usa generico
      }
    }

    const conn = await connectionRepository.create(userId, itemId, bank)

    // Dispara sync inicial em background (não bloqueia a resposta)
    SyncService.syncItem(userId, itemId).catch(err =>
      app.log.error({ err, itemId }, 'Erro no sync inicial'),
    )

    return reply.status(201).send({ ...conn, synced: null })
  })

  // POST /api/connections/:itemId/sync — sync manual
  // ?force=true → apaga transações externas existentes e re-sincroniza do zero
  app.post('/:itemId/sync', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const { itemId } = request.params as { itemId: string }
    const { force } = request.query as { force?: string }

    const conn = await connectionRepository.findByItemId(itemId)
    if (!conn || conn.userId !== userId) {
      return reply.status(404).send({ statusCode: 404, message: 'Conexão não encontrada' })
    }

    if (force === 'true') {
      // Apaga todas as transações externas deste banco para este usuário
      await prisma.$transaction([
        prisma.income.deleteMany({ where: { userId, bank: conn.bank, externalId: { not: null } } }),
        prisma.expense.deleteMany({ where: { userId, bank: conn.bank, externalId: { not: null } } }),
      ])
      // Reseta lastSync para buscar os últimos 90 dias novamente
      await connectionRepository.update(itemId, { lastSync: null })
    }

    const result = await SyncService.syncItem(userId, itemId)
    const updated = await connectionRepository.findByItemId(itemId)
    return reply.send({ ...updated, synced: result.synced })
  })

  // DELETE /api/connections/:itemId — desconectar banco
  app.delete('/:itemId', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const { itemId } = request.params as { itemId: string }

    const conn = await connectionRepository.findByItemId(itemId)
    if (!conn || conn.userId !== userId) {
      return reply.status(404).send({ statusCode: 404, message: 'Conexão não encontrada' })
    }

    await connectionRepository.delete(itemId, userId)
    return reply.status(204).send()
  })
}
