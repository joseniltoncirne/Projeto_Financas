import { prisma } from '../lib/prisma.js'

export const categoryRepository = {
  findAll(userId: string) {
    return prisma.category.findMany({ where: { userId } })
  },

  findByKey(userId: string, key: string) {
    return prisma.category.findUnique({
      where: { userId_key: { userId, key } },
    })
  },

  create(userId: string, data: { key: string; label: string; color?: string }) {
    return prisma.category.create({ data: { ...data, userId } })
  },

  update(
    userId: string,
    key: string,
    data: { label?: string; color?: string | null; budget?: number | null },
  ) {
    return prisma.category.updateMany({ where: { userId, key }, data })
  },

  delete(userId: string, key: string) {
    return prisma.category.deleteMany({ where: { userId, key } })
  },
}
