import { z } from 'zod'

const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/

export const upsertBalanceSchema = z.object({
  month: z.string().regex(monthRegex, 'Formato inválido. Use YYYY-MM'),
  bank: z.string().trim().min(1, 'Banco é obrigatório'),
  value: z.number().finite(),
})

export const listBalancesSchema = z.object({
  month: z.string().regex(monthRegex).optional(),
})

export type UpsertBalanceInput = z.infer<typeof upsertBalanceSchema>
