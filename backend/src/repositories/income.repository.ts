import { prisma } from '../lib/prisma.js'
import type { CreateIncomeInput } from '../schemas/income.schema.js'

export const incomeRepository = {
  findMany(userId: string, filters: { month?: string; bank?: string }) {
    return prisma.income.findMany({
      where: {
        userId,
        ...(filters.month && { month: filters.month }),
        ...(filters.bank && { bank: filters.bank }),
      },
      orderBy: [{ month: 'desc' }, { createdAt: 'desc' }],
    })
  },

  create(userId: string, data: CreateIncomeInput) {
    return prisma.income.create({ data: { ...data, userId } })
  },

  createMany(records: Array<CreateIncomeInput & { userId: string }>) {
    return prisma.income.createMany({ data: records })
  },

  findById(id: string, userId: string) {
    return prisma.income.findFirst({ where: { id, userId } })
  },

  delete(id: string, userId: string) {
    return prisma.income.deleteMany({ where: { id, userId } })
  },

  deleteByMonthAndBank(userId: string, month: string, bank: string) {
    return prisma.income.deleteMany({ where: { userId, month, bank } })
  },

  distinctBanks(userId: string) {
    return prisma.income.findMany({
      where: { userId },
      select: { bank: true },
      distinct: ['bank'],
    })
  },
}
