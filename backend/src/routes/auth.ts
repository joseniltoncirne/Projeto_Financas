import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { authService } from '../services/auth.service.js'
import { registerSchema, loginSchema, refreshSchema, logoutSchema } from '../schemas/auth.schema.js'
import { env } from '../config.js'

export async function authRoutes(app: FastifyInstance) {
  // POST /auth/register
  app.post('/register', async (request, reply) => {
    const input = registerSchema.parse(request.body)
    const user = await authService.register(input)

    const accessToken = app.jwt.sign(
      { sub: user.id, name: user.name },
      { expiresIn: env.JWT_ACCESS_EXPIRES },
    )
    const refreshToken = app.jwt.sign(
      { sub: user.id, type: 'refresh', jti: randomUUID() },
      { expiresIn: env.JWT_REFRESH_EXPIRES },
    )

    await authService.saveRefreshToken(user.id, refreshToken, env.JWT_REFRESH_EXPIRES)

    return reply.status(201).send({ user, accessToken, refreshToken })
  })

  // POST /auth/login
  app.post('/login', async (request, reply) => {
    const input = loginSchema.parse(request.body)
    const user = await authService.login(input)

    const accessToken = app.jwt.sign(
      { sub: user.id, name: user.name },
      { expiresIn: env.JWT_ACCESS_EXPIRES },
    )
    const refreshToken = app.jwt.sign(
      { sub: user.id, type: 'refresh', jti: randomUUID() },
      { expiresIn: env.JWT_REFRESH_EXPIRES },
    )

    await authService.saveRefreshToken(user.id, refreshToken, env.JWT_REFRESH_EXPIRES)

    return reply.send({ user, accessToken, refreshToken })
  })

  // POST /auth/refresh
  app.post('/refresh', async (request, reply) => {
    const { refreshToken } = refreshSchema.parse(request.body)
    const userId = await authService.rotateRefreshToken(refreshToken)

    const newAccessToken = app.jwt.sign(
      { sub: userId },
      { expiresIn: env.JWT_ACCESS_EXPIRES },
    )
    const newRefreshToken = app.jwt.sign(
      { sub: userId, type: 'refresh', jti: randomUUID() },
      { expiresIn: env.JWT_REFRESH_EXPIRES },
    )

    await authService.saveRefreshToken(userId, newRefreshToken, env.JWT_REFRESH_EXPIRES)

    return reply.send({ accessToken: newAccessToken, refreshToken: newRefreshToken })
  })

  // DELETE /auth/logout
  app.delete('/logout', async (request, reply) => {
    const { refreshToken } = logoutSchema.parse(request.body)
    await authService.logout(refreshToken)
    return reply.status(204).send()
  })
}
