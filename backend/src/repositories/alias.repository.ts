import { prisma } from '../lib/prisma.js'

export const aliasRepository = {
  findAll(userId: string) {
    return prisma.alias.findMany({ where: { userId } })
  },

  upsert(userId: string, normalizedName: string, alias: string) {
    return prisma.alias.upsert({
      where: { userId_normalizedName: { userId, normalizedName } },
      update: { alias },
      create: { userId, normalizedName, alias },
    })
  },

  delete(userId: string, normalizedName: string) {
    return prisma.alias.deleteMany({ where: { userId, normalizedName } })
  },
}
