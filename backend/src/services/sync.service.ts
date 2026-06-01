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
  isCredit: boolean
  sector: 'gasto' | 'investido' | 'entre_contas'
  category: string | null
  type: 'fixo' | 'variavel'
  bank: string
  dateStr: string
  externalId: string
}

// Title-case simples para nomes que vêm em ALL CAPS da Pluggy
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map(w => {
      // Mantém siglas curtas (LTDA, S.A., ME, EIRELI, etc.) em maiúscula
      if (/^(ltda|me|s\.?a\.?|eireli|epp|mei|cnpj|cpf)$/i.test(w)) return w.toUpperCase()
      return w.charAt(0).toUpperCase() + w.slice(1)
    })
    .join(' ')
}

// Mascara CPF preservando o "miolo" pra identificação visual sem expor o doc inteiro.
// "084.381.664-31" → "***.381.664-**"
function maskCpf(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 11) return value
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`
}

// Constrói um nome mais legível para a transação aproveitando paymentData/merchant.
// Para "PIX ENVIADO" sozinho ficamos com "PIX · Nome Do Destinatário".
function enrichTransactionName(t: PluggyTransaction, isIncome: boolean): string {
  const desc = (t.description || '').trim()
  const prefix = (t.operationType || t.paymentData?.paymentMethod || '').toUpperCase()

  // 1) merchant (PJ com CNPJ) tem prioridade — info mais confiável
  const merchantName = t.merchant?.businessName?.trim()
  if (merchantName) {
    return prefix ? `${prefix} · ${titleCase(merchantName)}` : titleCase(merchantName)
  }

  // 2) PIX com destinatário/pagador identificado pelo nome
  const counterparty = isIncome
    ? t.paymentData?.payer?.name
    : t.paymentData?.receiver?.name
  if (counterparty) {
    const tag = prefix || 'PIX'
    return `${tag} · ${titleCase(counterparty.trim())}`
  }

  // 3) Sem nome, mas com documento (PIX pra PF onde o nome veio null):
  //    usa CPF mascarado para diferenciar destinatários e permitir criação de regras
  const doc = isIncome
    ? t.paymentData?.payer?.documentNumber
    : t.paymentData?.receiver?.documentNumber
  if (doc?.value && doc.type === 'CPF') {
    const tag = prefix || 'PIX'
    return `${tag} · CPF ${maskCpf(doc.value)}`
  }

  return desc || 'Sem descrição'
}

// Detecta transferência entre contas próprias do usuário (não é gasto real).
// Em qualquer PIX saindo, o payer é sempre o dono da conta (= usuário).
// Em qualquer PIX entrando, o receiver é sempre o dono da conta (= usuário).
// O sinal de transferência própria está no OUTRO lado:
//  - DEBIT (saindo): receiver tem o mesmo CPF do usuário → transferiu pra si mesmo
//  - CREDIT (entrando): payer tem o mesmo CPF do usuário → recebeu de si mesmo
// Também aceita o flag explícito da Pluggy 'Same person transfer'.
function isSelfTransfer(t: PluggyTransaction, userCpf: string | null): boolean {
  const cat = (t.category || '').toLowerCase()
  if (cat.includes('same person transfer')) return true
  if (!userCpf) return false
  const cleanUser = userCpf.replace(/\D/g, '')
  if (!cleanUser) return false
  if (t.type === 'DEBIT') {
    const recv = (t.paymentData?.receiver?.documentNumber?.value || '').replace(/\D/g, '')
    return recv === cleanUser
  }
  if (t.type === 'CREDIT') {
    const payer = (t.paymentData?.payer?.documentNumber?.value || '').replace(/\D/g, '')
    return payer === cleanUser
  }
  return false
}

// Mapeia a categoria que a Pluggy já atribui (inglês) para nossa categoria PT.
// Retorna null quando não houver mapeamento confiável (deixa o classifier decidir).
function mapPluggyCategory(t: PluggyTransaction): string | null {
  const c = (t.merchant?.category || t.category || '').toLowerCase()
  if (!c) return null
  if (c.includes('eating out') || c.includes('food and drinks') || c.includes('groceries') || c.includes('restaurant'))
    return 'alimentacao'
  if (c.includes('pharmacy') || c.includes('health') || c.includes('medical'))
    return 'saude'
  if (c.includes('gas station') || c.includes('fuel'))
    return 'transporte'
  if (c.includes('transportation') || c.includes('ride') || c.includes('uber') || c.includes('taxi') || c.includes('parking'))
    return 'transporte'
  if (c.includes('clothing') || c.includes('apparel') || c.includes('shopping'))
    return 'outros'
  if (c.includes('beauty') || c.includes('personal care') || c.includes('barbershop'))
    return 'saude'
  if (c.includes('pet'))
    return 'outros'
  if (c.includes('education') || c.includes('school'))
    return 'educacao'
  if (c.includes('entertainment') || c.includes('sports practice') || c.includes('streaming'))
    return 'lazer'
  if (c.includes('housing') || c.includes('rent') || c.includes('utilities'))
    return 'moradia'
  // 'Transfer - PIX', 'Same person transfer', 'Services' são ambíguos — deixa o classifier
  return null
}

// Filtra apenas pagamentos recebidos pelo cartão — dinheiro que ENTROU no cartão
// para quitar a fatura. Esses não são gastos, são o oposto.
function isCreditCardPayment(t: PluggyTransaction): boolean {
  const desc = (t.description || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const paymentKw = [
    'pagamento recebido', 'pagamento de fatura', 'pagamento fatura',
    'saldo adicionado', 'pagamento automatico',
  ]
  return paymentKw.some(kw => desc.includes(kw))
}

export const SyncService = {
  mapTransaction(
    t: PluggyTransaction,
    bank: string,
    isIncome: boolean,
    userName: string | null,
    rules: Map<string, string>,
    amountRules: Map<string, string>,
    userCpf: string | null = null,
  ): MappedTransaction {
    const date = new Date(t.date)
    const month = t.date.slice(0, 7)
    const day = String(date.getUTCDate()).padStart(2, '0')
    const mo = String(date.getUTCMonth() + 1).padStart(2, '0')
    const yr = date.getUTCFullYear()
    const dateStr = `${day}/${mo}/${yr}`

    const amount = Math.abs(t.amount)
    const name = enrichTransactionName(t, isIncome)
    const classified = ClassifierService.classify(
      name,
      isIncome,
      amount,
      bank,
      userName,
      rules,
      amountRules,
    )

    // Transferência entre contas próprias (Same person transfer ou mesmo CPF)
    // sobrescreve a classificação — não é gasto/renda, é movimentação interna.
    let sector = classified.sector
    let isInternal = classified.isInternal
    if (isSelfTransfer(t, userCpf)) {
      sector = 'entre_contas'
      isInternal = true
    }

    // Se o classifier caiu em 'outros'/null, tenta a categoria que a Pluggy sugeriu
    let category = classified.category
    if ((!category || category === 'outros') && !classified.isResgate && !isInternal && sector === 'gasto') {
      const pluggyHint = mapPluggyCategory(t)
      if (pluggyHint) category = pluggyHint
    }

    return {
      month,
      name,
      amount,
      isIncome: classified.isIncome,
      isResgate: classified.isResgate,
      isInternal,
      isCredit: false, // sobrescrito pelo syncItem para transações de cartão
      sector,
      category,
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
        prisma.user.findUnique({ where: { id: userId }, select: { name: true, cpf: true } }),
        prisma.rule.findMany({ where: { userId } }),
        prisma.amountRule.findMany({ where: { userId } }),
      ])

      const rulesMap = new Map(rules.map(r => [r.memo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''), r.category]))
      const amountRulesMap = new Map(amountRules.map(r => [`${r.normalizedName}::${r.amount.toFixed(2)}`, r.category]))
      const userName = user?.name ?? null
      const userCpf = user?.cpf ?? null

      const to = new Date()
      const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000 // 7 dias de margem para transações que liquidam tarde
      const from = conn.lastSync
        ? new Date(new Date(conn.lastSync).getTime() - LOOKBACK_MS)
        : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

      console.log(`[sync] itemId=${itemId} from=${from.toISOString()} to=${to.toISOString()} (lastSync was ${conn.lastSync ?? 'null → 90 dias'})`)

      const accounts = await PluggyService.getAccounts(itemId)

      // Se banco não foi identificado no momento da conexão, tenta detectar:
      // 1) pelo nome da conta, 2) pelo código bancário (COMPE) — útil pra OAuth do MeuPluggy
      let bank = conn.bank
      if (bank === 'generico') {
        const firstBank = accounts.find(a => a.type === 'BANK')
        let detected = 'generico'
        if (firstBank?.name) {
          detected = PluggyService.mapBank(firstBank.name)
        }
        if (detected === 'generico' && firstBank?.bankData?.transferNumber) {
          detected = PluggyService.mapBankFromCompeCode(firstBank.bankData.transferNumber)
        }
        if (detected !== 'generico') {
          bank = detected
          await connectionRepository.update(itemId, { bank })
        }
      }

      const currentMonth = new Date().toISOString().slice(0, 7)

      // Coleta separado por origem para dedup cross-conta
      const bankMapped: MappedTransaction[] = []
      const creditMapped: MappedTransaction[] = []

      for (const account of accounts) {
        const isCreditCard = account.type === 'CREDIT'
        if (account.type !== 'BANK' && !isCreditCard) continue

        // Salva o saldo atual da conta corrente (não do cartão) para o mês corrente
        if (account.type === 'BANK' && account.balance != null) {
          await prisma.balance.upsert({
            where: { userId_month_bank: { userId, month: currentMonth, bank } },
            create: { userId, month: currentMonth, bank, value: account.balance },
            update: { value: account.balance },
          })
        }

        const transactions = await PluggyService.getTransactions(account.id, from, to)

        for (const t of transactions) {
          if (isCreditCard) {
            // Ignora lançamentos internos do cartão: pagamentos recebidos, faturas,
            // encargos contábeis e IOF — não são compras reais do usuário.
            if (isCreditCardPayment(t)) continue
            const mapped = { ...this.mapTransaction(t, bank, false, userName, rulesMap, amountRulesMap, userCpf), isCredit: true }
            creditMapped.push(mapped)
          } else {
            const isIncome = t.type === 'CREDIT'
            const mapped = this.mapTransaction(t, bank, isIncome, userName, rulesMap, amountRulesMap, userCpf)
            bankMapped.push(mapped)
          }
        }
      }

      // Dedup cross-conta: alguns bancos (ex: Nubank) retornam compras do cartão tanto
      // na conta corrente (BANK) quanto no cartão (CREDIT). Quando isso ocorre, preferimos
      // a versão do cartão (mais detalhada) e descartamos a da conta corrente.
      // Usamos fingerprint (name+amount+dateStr) APENAS para comparação entre origens —
      // duplicatas legítimas dentro da mesma conta não são afetadas.
      const creditFingerprints = new Set(
        creditMapped.map(t => `${t.name}::${t.amount}::${t.dateStr}`)
      )
      const filteredBankMapped = creditMapped.length > 0
        ? bankMapped.filter(t => !creditFingerprints.has(`${t.name}::${t.amount}::${t.dateStr}`))
        : bankMapped

      // Dedup por externalId dentro de cada origem (segurança)
      const seenIds = new Set<string>()
      const allMapped = [...filteredBankMapped, ...creditMapped].filter(t => {
        if (seenIds.has(t.externalId)) return false
        seenIds.add(t.externalId)
        return true
      })

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
