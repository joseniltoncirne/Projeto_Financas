import { z } from 'zod'

const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/

const transactionSchema = z.object({
  id: z.string().optional(),
  month: z.string().regex(monthRegex),
  dateStr: z.string().optional(),
  name: z.string().trim().min(1),
  amount: z.number().positive(),
  isIncome: z.boolean(),
  isResgate: z.boolean().default(false),
  isInternal: z.boolean().default(false),
  sector: z.enum(['gasto', 'investido', 'entre_contas']).default('gasto'),
  category: z.string().nullable().optional(),
  type: z.enum(['fixo', 'variavel']).default('variavel'),
  bank: z.string().trim().min(1),
})

export const bulkImportSchema = z.object({
  transactions: z.array(transactionSchema).min(1, 'Nenhuma transação para importar'),
  bank: z.string().trim().min(1),
  saldoFinal: z.number().optional(),
  saldoMonth: z.string().regex(monthRegex).optional(),
})

export type BulkImportInput = z.infer<typeof bulkImportSchema>
export type TransactionInput = z.infer<typeof transactionSchema>
