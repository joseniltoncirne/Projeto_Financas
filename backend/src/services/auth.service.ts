import bcrypt from 'bcryptjs'
import { userRepository } from '../repositories/user.repository.js'
import { refreshTokenRepository } from '../repositories/refreshToken.repository.js'
import type { RegisterInput, LoginInput } from '../schemas/auth.schema.js'

const BCRYPT_ROUNDS = 12

export const authService = {
  async register(input: RegisterInput) {
    const existing = await userRepository.findByCpf(input.cpf)
    if (existing) {
      const err = new Error('CPF já cadastrado') as Error & { statusCode: number }
      err.statusCode = 409
      throw err
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS)
    const user = await userRepository.create({
      name: input.name.trim().toUpperCase(),
      cpf: input.cpf,
      passwordHash,
    })

    return { id: user.id, name: user.name, cpf: user.cpf }
  },

  async login(input: LoginInput) {
    const user = await userRepository.findByCpf(input.cpf)
    if (!user) {
      const err = new Error('CPF ou senha inválidos') as Error & { statusCode: number }
      err.statusCode = 401
      throw err
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash)
    if (!valid) {
      const err = new Error('CPF ou senha inválidos') as Error & { statusCode: number }
      err.statusCode = 401
      throw err
    }

    return { id: user.id, name: user.name, cpf: user.cpf }
  },

  async saveRefreshToken(userId: string, token: string, expiresIn: string) {
    // Limpa tokens expirados deste usuário (mantém os ativos para multi-dispositivo)
    await refreshTokenRepository.deleteExpiredForUser(userId).catch(() => null)
    const ms = parseExpiry(expiresIn)
    const expiresAt = new Date(Date.now() + ms)
    await refreshTokenRepository.create({ userId, token, expiresAt })
  },

  async rotateRefreshToken(oldToken: string) {
    const record = await refreshTokenRepository.findByToken(oldToken)
    if (!record) {
      const err = new Error('Refresh token inválido') as Error & { statusCode: number }
      err.statusCode = 401
      throw err
    }
    if (record.expiresAt < new Date()) {
      await refreshTokenRepository.delete(oldToken)
      const err = new Error('Refresh token expirado') as Error & { statusCode: number }
      err.statusCode = 401
      throw err
    }
    await refreshTokenRepository.delete(oldToken)
    return record.userId
  },

  async logout(token: string) {
    await refreshTokenRepository.delete(token).catch(() => null)
  },
}

function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/)
  if (!match) return 7 * 24 * 60 * 60 * 1000
  const value = parseInt(match[1])
  const unit = match[2]
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  }
  return value * multipliers[unit]
}
