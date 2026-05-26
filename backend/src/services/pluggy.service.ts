import { env } from '../config.js'

const BASE_URL = 'https://api.pluggy.ai'

// ─── Tipos da API Pluggy ────────────────────────────────────────────────────

export interface PluggyAccount {
  id: string
  itemId: string
  type: 'BANK' | 'CREDIT'
  subtype: string
  name: string
  balance: number
  currencyCode: string
}

export interface PluggyTransaction {
  id: string
  accountId: string
  date: string        // ISO date string
  description: string
  amount: number      // valor absoluto
  type: 'CREDIT' | 'DEBIT'
  category: string | null
  paymentData?: {
    paymentMethod?: string
  }
}

export interface PluggyItem {
  id: string
  status: 'UPDATED' | 'UPDATING' | 'WAITING_USER_INPUT' | 'LOGIN_ERROR' | 'OUTDATED'
  connector: {
    id: number
    name: string
    primaryColor?: string
  }
  lastUpdatedAt?: string
}

interface PluggyTransactionPage {
  results: PluggyTransaction[]
  page: number
  totalPages: number
  total: number
}

// ─── Cache do apiKey (válido 2h, renovado com 10min de margem) ──────────────

let cachedKey: { key: string; expiresAt: number } | null = null

async function pluggyFetch<T>(
  path: string,
  options: RequestInit & { apiKey?: string } = {},
): Promise<T> {
  const { apiKey, ...fetchOptions } = options
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> ?? {}),
  }
  if (apiKey) headers['X-API-KEY'] = apiKey

  const res = await fetch(`${BASE_URL}${path}`, { ...fetchOptions, headers })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Pluggy ${path} → ${res.status}: ${body}`)
  }
  return res.json() as Promise<T>
}

// ─── Serviço ────────────────────────────────────────────────────────────────

export const PluggyService = {
  async getApiKey(): Promise<string> {
    const now = Date.now()
    if (cachedKey && cachedKey.expiresAt > now) return cachedKey.key

    const data = await pluggyFetch<{ apiKey: string }>('/auth', {
      method: 'POST',
      body: JSON.stringify({
        clientId: env.PLUGGY_CLIENT_ID,
        clientSecret: env.PLUGGY_CLIENT_SECRET,
      }),
    })

    // apiKey válido por 2h; cache por 110min para ter margem
    cachedKey = { key: data.apiKey, expiresAt: now + 110 * 60 * 1000 }
    return data.apiKey
  },

  async createConnectToken(itemId?: string): Promise<string> {
    const apiKey = await this.getApiKey()
    const body: Record<string, unknown> = {}
    if (itemId) body.itemId = itemId

    const data = await pluggyFetch<{ accessToken: string }>('/connect_token', {
      method: 'POST',
      apiKey,
      body: JSON.stringify(body),
    })
    return data.accessToken
  },

  async getItem(itemId: string): Promise<PluggyItem> {
    const apiKey = await this.getApiKey()
    return pluggyFetch<PluggyItem>(`/items/${itemId}`, { apiKey })
  },

  async getAccounts(itemId: string): Promise<PluggyAccount[]> {
    const apiKey = await this.getApiKey()
    const data = await pluggyFetch<{ results: PluggyAccount[] }>(
      `/accounts?itemId=${itemId}`,
      { apiKey },
    )
    return data.results
  },

  async getTransactions(
    accountId: string,
    from: Date,
    to: Date,
  ): Promise<PluggyTransaction[]> {
    const apiKey = await this.getApiKey()
    const fromStr = from.toISOString().slice(0, 10)
    const toStr = to.toISOString().slice(0, 10)

    const all: PluggyTransaction[] = []
    let page = 1
    let totalPages = 1

    while (page <= totalPages) {
      const data = await pluggyFetch<PluggyTransactionPage>(
        `/transactions?accountId=${accountId}&from=${fromStr}&to=${toStr}&pageSize=500&page=${page}`,
        { apiKey },
      )
      all.push(...data.results)
      totalPages = data.totalPages
      page++
    }

    return all
  },

  // Mapeia nome do conector ou instituição Pluggy para nosso código de banco
  mapBank(connectorName: string): string {
    const name = connectorName.toLowerCase()
    if (name.includes('nu pagamento') || name.includes('nubank')) return 'nubank'
    if (name.includes('inter')) return 'inter'
    if (name.includes('caixa')) return 'caixa'
    if (name.includes('itaú') || name.includes('itau')) return 'itau'
    if (name.includes('bradesco')) return 'bradesco'
    if (name.includes('santander')) return 'santander'
    if (name.includes('brasil') || name.includes(' bb ') || name.includes('banco do brasil')) return 'bb'
    if (name.includes('stone')) return 'stone'
    if (name.includes('original')) return 'original'
    if (name.includes('mercado')) return 'mercadopago'
    if (name.includes('picpay')) return 'picpay'
    if (name.includes('c6')) return 'c6'
    if (name.includes('xp')) return 'xp'
    return 'generico'
  },
}
