import { prisma } from '../lib/prisma.js'

export const refreshTokenRepository = {
  create(data: { userId: string; token: string; expiresAt: Date }) {
    return prisma.refreshToken.create({ data })
  },

  findByToken(token: string) {
    return prisma.refreshToken.findUnique({ where: { token } })
  },

  delete(token: string) {
    return prisma.refreshToken.delete({ where: { token } })
  },

  deleteAllForUser(userId: string) {
    return prisma.refreshToken.deleteMany({ where: { userId } })
  },

  deleteExpired() {
    return prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    })
  },
}
