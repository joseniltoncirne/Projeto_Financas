import { randomUUID } from 'node:crypto'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import jwt from '@fastify/jwt'
import { env } from './config.js'
import { errorHandler } from './middleware/error.middleware.js'
import { authRoutes } from './routes/auth.js'
import { incomeRoutes } from './routes/incomes.js'
import { expenseRoutes } from './routes/expenses.js'
import { balanceRoutes } from './routes/balances.js'
import { ruleRoutes } from './routes/rules.js'
import { categoryRoutes } from './routes/categories.js'
import { importRoutes } from './routes/import.js'
import { bankRoutes } from './routes/banks.js'
import { aliasRoutes } from './routes/aliases.js'

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'warn' : 'info',
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    genReqId: () => randomUUID(),
  })

  // ── Plugins de segurança ────────────────────────────────────────────────────
  await app.register(helmet, {
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })

  await app.register(cors, {
    origin: env.ALLOWED_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  await app.register(rateLimit, {
    global: false, // aplica só onde configurado
    max: 200,
    timeWindow: '1 minute',
  })

  // ── JWT ─────────────────────────────────────────────────────────────────────
  await app.register(jwt, { secret: env.JWT_SECRET })

  // ── Error handler global ────────────────────────────────────────────────────
  app.setErrorHandler(errorHandler)

  // ── Rotas de autenticação (com rate limiting próprio) ───────────────────────
  await app.register(
    async (authApp) => {
      await authApp.register(rateLimit, { max: 10, timeWindow: '1 minute' })
      await authApp.register(authRoutes)
    },
    { prefix: '/auth' },
  )

  // ── Rotas da API (protegidas por JWT) ───────────────────────────────────────
  await app.register(incomeRoutes, { prefix: '/api/incomes' })
  await app.register(expenseRoutes, { prefix: '/api/expenses' })
  await app.register(balanceRoutes, { prefix: '/api/balances' })
  await app.register(ruleRoutes, { prefix: '/api' })
  await app.register(categoryRoutes, { prefix: '/api/categories' })
  await app.register(importRoutes, { prefix: '/api/import' })
  await app.register(bankRoutes, { prefix: '/api/banks' })
  await app.register(aliasRoutes, { prefix: '/api/aliases' })

  // ── Health check ────────────────────────────────────────────────────────────
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  return app
}
