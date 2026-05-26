import { z } from 'zod'

export const upsertRuleSchema = z.object({
  memo: z.string().trim().toLowerCase().min(1, 'Memo é obrigatório'),
  category: z.string().trim().min(1, 'Categoria é obrigatória'),
})

export const upsertAmountRuleSchema = z.object({
  normalizedName: z.string().trim().min(1),
  amount: z.number().positive(),
  category: z.string().trim().min(1),
})

export const deleteAmountRuleSchema = z.object({
  normalizedName: z.string().min(1),
  amount: z.coerce.number().positive(),
})

export const deleteRuleSchema = z.object({
  memo: z.string().trim().toLowerCase().min(1, 'Memo é obrigatório'),
})

export type UpsertRuleInput = z.infer<typeof upsertRuleSchema>
export type UpsertAmountRuleInput = z.infer<typeof upsertAmountRuleSchema>
