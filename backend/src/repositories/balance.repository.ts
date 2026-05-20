import { prisma } from '../lib/prisma.js'

export const balanceRepository = {
  findMany(userId: string, month?: string) {
    return prisma.balance.findMany({
      where: { userId, ...(month && { month }) },
      orderBy: { month: 'desc' },
    })
  },

  upsert(userId: string, month: string, bank: string, value: number) {
    return prisma.balance.upsert({
      where: { userId_month_bank: { userId, month, bank } },
      create: { userId, month, bank, value },
      update: { value },
    })
  },
}
