import { prisma } from '../lib/prisma.js'

export const deletedExternalIdRepository = {
  findByUser(userId: string) {
    return prisma.deletedExternalId.findMany({
      where: { userId },
      orderBy: { deletedAt: 'desc' },
    })
  },

  // Insere o registro do excluído. Idempotente: se já existir o mesmo (userId, externalId),
  // ignora silenciosamente.
  async insert(data: {
    userId: string
    externalId: string
    kind: 'expense' | 'income'
    name: string
    amount: number
    bank: string
    dateStr: string | null
    month: string
  }) {
    try {
      await prisma.deletedExternalId.create({ data })
    } catch (err: unknown) {
      // P2002 = unique constraint violation → já existe, ok
      if ((err as { code?: string }).code !== 'P2002') throw err
    }
  },

  // Coleta externalIds excluídos para um usuário — usado pelo dedup do sync
  async externalIdsForUser(userId: string): Promise<Set<string>> {
    const rows = await prisma.deletedExternalId.findMany({
      where: { userId },
      select: { externalId: true },
    })
    return new Set(rows.map(r => r.externalId))
  },

  // Restaura: remove o tombstone. O próximo sync re-importa.
  async restore(userId: string, id: string) {
    return prisma.deletedExternalId.deleteMany({ where: { id, userId } })
  },
}
