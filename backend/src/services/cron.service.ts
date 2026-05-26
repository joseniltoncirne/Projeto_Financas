import cron from 'node-cron'
import { prisma } from '../lib/prisma.js'
import { SyncService } from './sync.service.js'
import { refreshTokenRepository } from '../repositories/refreshToken.repository.js'

export function startCronJobs() {
  // Limpeza de locks órfãos no boot: se o processo morreu durante um sync,
  // o DB ficou com status='syncing' mas não há ninguém sincronizando.
  prisma.bankConnection.updateMany({
    where: { status: 'syncing' },
    data: { status: 'error' },
  }).then(result => {
    if (result.count > 0) {
      console.log(`[boot] ${result.count} sync(s) órfãos resetados para 'error'.`)
    }
  }).catch(err => console.error('[boot] Erro ao resetar syncs órfãos:', err))

  // Limpeza diária de refresh tokens expirados (todo dia às 3h)
  cron.schedule('0 3 * * *', async () => {
    try {
      const result = await refreshTokenRepository.deleteExpired()
      if (result.count > 0) {
        console.log(`[cron] ${result.count} refresh tokens expirados removidos.`)
      }
    } catch (err) {
      console.error('[cron] Erro ao limpar refresh tokens:', err)
    }
  })

  // Sincroniza todas as conexões ativas a cada 1 hora
  cron.schedule('0 * * * *', async () => {
    console.log('[cron] Iniciando sync horário de todas as conexões...')

    const connections = await prisma.bankConnection.findMany({
      where: { status: { not: 'syncing' } },
    })

    if (!connections.length) {
      console.log('[cron] Nenhuma conexão ativa.')
      return
    }

    const results = await Promise.allSettled(
      connections.map(conn => SyncService.syncItem(conn.userId, conn.itemId))
    )

    const synced = results
      .filter((r): r is PromiseFulfilledResult<{ synced: number }> => r.status === 'fulfilled')
      .reduce((sum, r) => sum + r.value.synced, 0)

    const errors = results.filter(r => r.status === 'rejected').length

    console.log(`[cron] Sync concluído — ${synced} transações novas, ${errors} erros em ${connections.length} conexões.`)
  })

  console.log('[cron] Sync horário agendado (a cada 1h).')
  console.log('[cron] Limpeza diária de refresh tokens agendada (3h da manhã).')
}
