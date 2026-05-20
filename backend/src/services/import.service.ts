import { prisma } from '../lib/prisma.js'
import { balanceRepository } from '../repositories/balance.repository.js'
import type { BulkImportInput } from '../schemas/import.schema.js'

export const importService = {
  async bulkImport(userId: string, input: BulkImportInput) {
    const { transactions, bank, saldoFinal, saldoMonth } = input

    const incomes = transactions
      .filter(t => t.isIncome)
      .map(t => ({
        userId,
        month: t.month,
        name: t.name,
        amount: t.amount,
        bank: t.bank ?? bank,
        dateStr: t.dateStr ?? null,
      }))

    const expenses = transactions
      .filter(t => !t.isIncome)
      .map(t => ({
        userId,
        month: t.month,
        name: t.name,
        amount: t.amount,
        type: t.type,
        category: t.category ?? null,
        sector: t.sector,
        bank: t.bank ?? bank,
        isResgate: t.isResgate,
        isInternal: t.isInternal,
        dateStr: t.dateStr ?? null,
      }))

    // Executa dentro de uma transaction para garantir atomicidade
    await prisma.$transaction(async tx => {
      if (incomes.length) await tx.income.createMany({ data: incomes })
      if (expenses.length) await tx.expense.createMany({ data: expenses })
      if (saldoFinal !== undefined && saldoMonth) {
        await tx.balance.upsert({
          where: { userId_month_bank: { userId, month: saldoMonth, bank } },
          create: { userId, month: saldoMonth, bank, value: saldoFinal },
          update: { value: saldoFinal },
        })
      }
    })

    return { imported: transactions.length }
  },
}
