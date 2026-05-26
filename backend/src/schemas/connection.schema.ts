import { z } from 'zod'

export const saveConnectionSchema = z.object({
  itemId: z.string().min(1),
  connectorName: z.string().optional(),
})

export type SaveConnectionInput = z.infer<typeof saveConnectionSchema>
