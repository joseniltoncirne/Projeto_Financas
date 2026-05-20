import { z } from 'zod'

export const upsertAliasSchema = z.object({
  normalizedName: z.string().trim().min(1, 'Chave é obrigatória'),
  alias: z.string().trim().min(1, 'Apelido é obrigatório'),
})

export const deleteAliasSchema = z.object({
  normalizedName: z.string().min(1),
})
