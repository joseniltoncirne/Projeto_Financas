import { prisma } from '../lib/prisma.js'
import type { BankConnection } from '@prisma/client'

export const connectionRepository = {
  findByUserId(userId: string): Promise<BankConnection[]> {
    return prisma.bankConnection.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    })
  },

  findByItemId(itemId: string): Promise<BankConnection | null> {
    return prisma.bankConnection.findUnique({ where: { itemId } })
  },

  create(userId: string, itemId: string, bank: string): Promise<BankConnection> {
    return prisma.bankConnection.create({
      data: { userId, itemId, bank, status: 'ok' },
    })
  },

  update(itemId: string, data: Partial<Pick<BankConnection, 'status' | 'lastSync' | 'bank'>>): Promise<BankConnection> {
    return prisma.bankConnection.update({ where: { itemId }, data })
  },

  async delete(itemId: string, userId: string): Promise<void> {
    await prisma.bankConnection.deleteMany({ where: { itemId, userId } })
  },
}
