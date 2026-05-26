import { z } from 'zod'

export const createCategorySchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9_]+$/, 'key deve conter apenas letras minúsculas, números e _'),
  label: z.string().trim().min(1, 'Label é obrigatório'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
})

export const updateCategorySchema = z.object({
  label: z.string().trim().min(1).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  budget: z.number().positive().nullable().optional(),
})

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
