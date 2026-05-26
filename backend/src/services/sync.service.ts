import { prisma } from '../lib/prisma.js'
import { connectionRepository } from '../repositories/connection.repository.js'
import { PluggyService, type PluggyTransaction } from './pluggy.service.js'
import { importService } from './import.service.js'
import { ClassifierService } from './classifier.service.js'

// Lock in-memory para evitar syncs concorrentes do mesmo itemId.
// Mapeia itemId → timestamp de quando o lock foi adquirido.
// TTL evita lock eterno se o processo morrer no meio do sync.
// OBS: válido para deploy single-instance. Para multi-instância seria
// necessário um lock distribuído (Redis SETNX, ou advisory lock do Postgres).
const syncLocks = new Map<string, number>()
const LOCK_TTL_MS = 5 * 60 * 1000 // 5 minutos

function tryAcquireLock(itemId: string): boolean {
  const now = Date.now()
  const lockedAt = syncLocks.get(itemId)
  if (lockedAt && (now - lockedAt) < LOCK_TTL_MS) return false
  syncLocks.set(itemId, now)
  return true
}

function releaseLock(itemId: string): void {
  syncLocks.delete(itemId)
}

export interface MappedTransaction {
  month: string
  name: string
  amount: number
  isIncome: boolean
  isResgate: boolean
  isInternal: boolean
  sector: 'gasto' | 'investido' | 'entre_contas'
  category: string | null
  type: 'fixo' | 'variavel'
  bank: string
  dateStr: string
  externalId: string
}

export const SyncService = {
  mapTransaction(
    t: PluggyTransaction,
    bank: string,
    isIncome: boolean,
    userName: string | null,
    rules: Map<string, string>,
    amountRules: Map<string, string>,
  ): MappedTransaction {
    const date = new Date(t.date)
    const month = t.date.slice(0, 7)
    const day = String(date.getUTCDate()).padStart(2, '0')
    const mo = String(date.getUTCMonth() + 1).padStart(2, '0')
    const yr = date.getUTCFullYear()
    const dateStr = `${day}/${mo}/${yr}`

    const amount = Math.abs(t.amount)
    const classified = ClassifierService.classify(
      t.description ?? '',
      isIncome,
      amount,
      bank,
      userName,
      rules,
      amountRules,
    )

    return {
      month,
      name: t.description ?? 'Sem descrição',
      amount,
      isIncome: classified.isIncome,
      isResgate: classified.isResgate,
      isInternal: classified.isInternal,
      sector: classified.sector,
      category: classified.category,
      type: 'variavel',
      bank,
      dateStr,
      externalId: t.id,
    }
  },

  async syncItem(userId: string, itemId: string): Promise<{ synced: number }> {
    const conn = await connectionRepository.findByItemId(itemId)
    if (!conn || conn.userId !== userId) {
      throw new Error('Conexão não encontrada')
    }

    if (!tryAcquireLock(itemId)) {
      const err = new Error('Sincronização já em andamento para este banco') as Error & { statusCode: number }
      err.statusCode = 409
      throw err
    }

    await connectionRepository.update(itemId, { status: 'syncing' })

    try {
      // Carrega dados do usuário e suas regras para classificação
      const [user, rules, amountRules] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
        prisma.rule.findMany({ where: { userId } }),
        prisma.amountRule.findMany({ where: { userId } }),
      ])

      const rulesMap = new Map(rules.map(r => [r.memo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''), r.category]))
      const amountRulesMap = new Map(amountRules.map(r => [`${r.normalizedName}::${r.amount.toFixed(2)}`, r.category]))
      const userName = user?.name ?? null

      const to = new Date()
      const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000 // 7 dias de margem para transações que liquidam tarde
      const from = conn.lastSync
        ? new Date(new Date(conn.lastSync).getTime() - LOOKBACK_MS)
        : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

      console.log(`[sync] itemId=${itemId} from=${from.toISOString()} to=${to.toISOString()} (lastSync was ${conn.lastSync ?? 'null → 90 dias'})`)

      const allMapped: MappedTransaction[] = []
      const accounts = await PluggyService.getAccounts(itemId)

      // Se banco não foi identificado no momento da conexão, detecta pelo nome da conta
      let bank = conn.bank
      if (bank === 'generico') {
        const firstBank = accounts.find(a => a.type === 'BANK')
        if (firstBank?.name) {
          const detected = PluggyService.mapBank(firstBank.name)
          if (detected !== 'generico') {
            bank = detected
            await connectionRepository.update(itemId, { bank })
          }
        }
      }

      const currentMonth = new Date().toISOString().slice(0, 7)

      for (const account of accounts) {
        if (account.type !== 'BANK') continue

        // Salva o saldo atual da conta corrente para o mês corrente
        if (account.balance != null) {
          await prisma.balance.upsert({
            where: { userId_month_bank: { userId, month: currentMonth, bank } },
            create: { userId, month: currentMonth, bank, value: account.balance },
            update: { value: account.balance },
          })
        }

        const transactions = await PluggyService.getTransactions(account.id, from, to)

        for (const t of transactions) {
          const isIncome = t.type === 'CREDIT'
          const mapped = this.mapTransaction(t, bank, isIncome, userName, rulesMap, amountRulesMap)
          allMapped.push(mapped)
        }
      }

      const result = await importService.bulkImportExternal(userId, allMapped, bank)

      await connectionRepository.update(itemId, {
        status: 'ok',
        lastSync: new Date(),
      })

      return result
    } catch (err) {
      await connectionRepository.update(itemId, { status: 'error' })
      throw err
    } finally {
      releaseLock(itemId)
    }
  },
}
