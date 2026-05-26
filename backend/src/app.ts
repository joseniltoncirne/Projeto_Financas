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
import { connectionRoutes } from './routes/connections.js'
import { webhookRoutes } from './routes/webhooks.js'
import { fixedExpenseRoutes } from './routes/fixed-expenses.js'

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

  // ── CORS: allowlist mesmo em dev (localhost + IPs da rede privada) ─────────
  // Em prod, ALLOWED_ORIGIN pode ter múltiplas origens separadas por vírgula.
  const allowedOrigins = env.ALLOWED_ORIGIN.split(',').map(s => s.trim()).filter(Boolean)
  const isPrivateHost = (host: string) => (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
  )
  await app.register(cors, {
    origin: (origin, cb) => {
      // Requisições sem Origin (curl, healthcheck, server-to-server)
      if (!origin) return cb(null, true)
      // Produção: só ALLOWED_ORIGIN
      if (env.NODE_ENV === 'production') {
        return cb(null, allowedOrigins.includes(origin))
      }
      // Dev: localhost + rede privada (permite teste em celular na mesma rede)
      try {
        const url = new URL(origin)
        return cb(null, isPrivateHost(url.hostname))
      } catch {
        return cb(null, false)
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  // Fail-fast em prod: ALLOWED_ORIGIN não pode ser localhost
  if (env.NODE_ENV === 'production' && allowedOrigins.some(o => o.includes('localhost') || o.includes('127.0.0.1'))) {
    throw new Error('ALLOWED_ORIGIN não pode apontar para localhost em produção')
  }

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
      await authApp.register(rateLimit, { max: 5, timeWindow: '1 minute' })
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
  await app.register(connectionRoutes, { prefix: '/api/connections' })
  await app.register(fixedExpenseRoutes, { prefix: '/api/fixed-expenses' })
  await app.register(webhookRoutes, { prefix: '/webhooks' })

  // ── Health check ────────────────────────────────────────────────────────────
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  return app
}
