import { prisma } from '../lib/prisma.js'
import type { CreateExpenseInput, UpdateExpenseInput } from '../schemas/expense.schema.js'

export const expenseRepository = {
  findMany(
    userId: string,
    filters: { month?: string; bank?: string; sector?: string },
  ) {
    return prisma.expense.findMany({
      where: {
        userId,
        ...(filters.month && { month: filters.month }),
        ...(filters.bank && { bank: filters.bank }),
        ...(filters.sector && { sector: filters.sector }),
      },
      orderBy: [{ month: 'desc' }, { createdAt: 'desc' }],
    })
  },

  create(userId: string, data: CreateExpenseInput) {
    return prisma.expense.create({ data: { ...data, userId } })
  },

  createMany(records: Array<CreateExpenseInput & { userId: string }>) {
    return prisma.expense.createMany({ data: records })
  },

  findById(id: string, userId: string) {
    return prisma.expense.findFirst({ where: { id, userId } })
  },

  update(id: string, userId: string, data: UpdateExpenseInput) {
    return prisma.expense.updateMany({ where: { id, userId }, data })
  },

  delete(id: string, userId: string) {
    return prisma.expense.deleteMany({ where: { id, userId } })
  },

  deleteByMonthAndBank(userId: string, month: string, bank: string) {
    return prisma.expense.deleteMany({ where: { userId, month, bank } })
  },

  distinctBanks(userId: string) {
    return prisma.expense.findMany({
      where: { userId },
      select: { bank: true },
      distinct: ['bank'],
    })
  },
}
