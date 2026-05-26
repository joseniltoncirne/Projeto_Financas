import { timingSafeEqual } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { connectionRepository } from '../repositories/connection.repository.js'
import { SyncService } from '../services/sync.service.js'
import { env } from '../config.js'

// Compara dois tokens em tempo constante (evita timing attacks que poderiam
// vazar o secret caractere por caractere via diferença de latência).
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

// Pluggy permite configurar headers customizados no webhook.
// Convencionamos `Authorization: Bearer <secret>`.
function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : authHeader.trim()
}

export async function webhookRoutes(app: FastifyInstance) {
  // POST /webhooks/pluggy
  // Pluggy envia este evento quando os dados de um item são atualizados
  app.post('/pluggy', async (request, reply) => {
    const token = extractToken(request.headers.authorization)
    if (!token || !safeEqual(token, env.PLUGGY_WEBHOOK_SECRET)) {
      app.log.warn({ ip: request.ip }, 'Webhook Pluggy rejeitado: token inválido')
      return reply.status(401).send({ ok: false })
    }

    const body = request.body as { event?: string; itemId?: string }

    // Responde 200 imediatamente (Pluggy exige < 30s)
    reply.status(200).send({ ok: true })

    if (body?.event === 'item/updated' && body?.itemId) {
      const conn = await connectionRepository.findByItemId(body.itemId)
      if (conn) {
        SyncService.syncItem(conn.userId, body.itemId).catch(err =>
          app.log.error({ err, itemId: body.itemId }, 'Erro no sync via webhook'),
        )
      }
    }
  })
}
