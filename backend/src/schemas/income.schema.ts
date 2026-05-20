import { z } from 'zod'

const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/
const dateStrRegex = /^\d{2}\/\d{2}\/\d{4}$/

export const createIncomeSchema = z.object({
  month: z.string().regex(monthRegex, 'Formato inválido. Use YYYY-MM'),
  name: z.string().trim().min(1, 'Nome é obrigatório'),
  amount: z.number().positive('Valor deve ser positivo'),
  bank: z.string().trim().min(1, 'Banco é obrigatório'),
  dateStr: z.string().regex(dateStrRegex).optional(),
})

export const listIncomesSchema = z.object({
  month: z.string().regex(monthRegex).optional(),
  bank: z.string().optional(),
})

export const bulkClearIncomesSchema = z.object({
  month: z.string().regex(monthRegex, 'Formato inválido. Use YYYY-MM'),
  bank: z.string().trim().min(1),
})

export type CreateIncomeInput = z.infer<typeof createIncomeSchema>
