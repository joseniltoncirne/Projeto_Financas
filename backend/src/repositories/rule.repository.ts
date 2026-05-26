import { prisma } from '../lib/prisma.js'

export const ruleRepository = {
  findAll(userId: string) {
    return prisma.rule.findMany({ where: { userId } })
  },

  upsert(userId: string, memo: string, category: string) {
    return prisma.rule.upsert({
      where: { userId_memo: { userId, memo } },
      create: { userId, memo, category },
      update: { category },
    })
  },

  delete(userId: string, memo: string) {
    return prisma.rule.deleteMany({ where: { userId, memo } })
  },
}

export const amountRuleRepository = {
  findAll(userId: string) {
    return prisma.amountRule.findMany({ where: { userId } })
  },

  upsert(
    userId: string,
    normalizedName: string,
    amount: number,
    category: string,
  ) {
    return prisma.amountRule.upsert({
      where: { userId_normalizedName_amount: { userId, normalizedName, amount } },
      create: { userId, normalizedName, amount, category },
      update: { category },
    })
  },

  delete(userId: string, normalizedName: string, amount: number) {
    return prisma.amountRule.deleteMany({
      where: { userId, normalizedName, amount },
    })
  },
}
