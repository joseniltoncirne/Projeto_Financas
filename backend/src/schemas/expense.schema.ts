import { z } from 'zod'

const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/
const dateStrRegex = /^\d{2}\/\d{2}\/\d{4}$/

export const createExpenseSchema = z.object({
  month: z.string().regex(monthRegex, 'Formato inválido. Use YYYY-MM'),
  name: z.string().trim().min(1, 'Nome é obrigatório'),
  amount: z.number().positive('Valor deve ser positivo'),
  type: z.enum(['fixo', 'variavel']).default('variavel'),
  category: z.string().trim().optional(),
  sector: z.enum(['gasto', 'investido', 'entre_contas']).default('gasto'),
  bank: z.string().trim().min(1, 'Banco é obrigatório'),
  isResgate: z.boolean().default(false),
  isInternal: z.boolean().default(false),
  dateStr: z.string().regex(dateStrRegex).optional(),
})

export const updateExpenseSchema = z.object({
  category: z.string().trim().nullable().optional(),
  sector: z.enum(['gasto', 'investido', 'entre_contas']).optional(),
  type: z.enum(['fixo', 'variavel']).optional(),
})

export const listExpensesSchema = z.object({
  month: z.string().regex(monthRegex).optional(),
  bank: z.string().optional(),
  sector: z.enum(['gasto', 'investido', 'entre_contas']).optional(),
})

export const bulkClearExpensesSchema = z.object({
  month: z.string().regex(monthRegex, 'Formato inválido. Use YYYY-MM'),
  bank: z.string().trim().min(1),
})

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>
