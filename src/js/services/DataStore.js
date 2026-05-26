// ═══════════════════════════════════════════════════════════════════════════════
class DataStore {
    static _cache = { incomes: [], expenses: [], balances: {}, rules: {}, amountRules: {}, categories: {} }

    // ── Init ─────────────────────────────────────────────────────────────────────

    static async setUser(userId) {
        this._userId = userId
        await this._loadAll()
    }

    static async _loadAll() {
        const [incomes, expenses, balances, rules, amountRules, categories, aliases] = await Promise.all([
            ApiClient.get('/api/incomes'),
            ApiClient.get('/api/expenses'),
            ApiClient.get('/api/balances'),
            ApiClient.get('/api/rules'),
            ApiClient.get('/api/amount-rules'),
            ApiClient.get('/api/categories'),
            ApiClient.get('/api/aliases'),
        ])
        this._cache = {
            incomes: incomes.map(i => this._normalizeIncome(i)),
            expenses: expenses.map(e => this._normalizeExpense(e)),
            balances: this._buildBalanceMap(balances),
            rules: this._buildRulesMap(rules),
            amountRules: this._buildAmountRulesMap(amountRules),
            categories: this._buildCategoriesMap(categories),
            aliases: this._buildAliasMap(aliases),
        }
        // Verifica metas de gasto após cada carregamento
        if (typeof BudgetNotifier !== 'undefined' && typeof app !== 'undefined') {
            BudgetNotifier.check(app.currentMonth).catch(err => console.error('[BudgetNotifier] Erro ao checar metas:', err))
        }
    }

    // ── Normalization ─────────────────────────────────────────────────────────────

    static _normalizeIncome(i) {
        return { id: i.id, month: i.month, name: i.name, amount: i.amount, bank: i.bank, dateStr: i.dateStr || null }
    }

    static _normalizeExpense(e) {
        return {
            id: e.id, month: e.month, name: e.name, amount: e.amount,
            type: e.type, category: e.category || null, sector: e.sector, bank: e.bank,
            resgate: e.isResgate, internal: e.isInternal, dateStr: e.dateStr || null,
            externalId: e.externalId || null,
        }
    }

    static _buildBalanceMap(balances) {
        const map = {}
        balances.forEach(b => { map[`${b.month}::${b.bank}`] = b.value })
        return map
    }

    static _buildRulesMap(rules) {
        const map = {}
        rules.forEach(r => {
            const key = r.memo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
            map[key] = r.category
        })
        return map
    }

    static _buildAmountRulesMap(amountRules) {
        const map = {}
        amountRules.forEach(r => { map[`${r.normalizedName}::${Number(r.amount).toFixed(2)}`] = r.category })
        return map
    }

    static _buildCategoriesMap(categories) {
        const map = {}
        categories.forEach(c => { map[c.key] = { label: c.label, color: c.color, isFixed: !!c.isFixed, budget: c.budget ?? null } })
        return map
    }

    static _buildAliasMap(aliases) {
        const map = {}
        aliases.forEach(a => { map[a.normalizedName] = a.alias })
        return map
    }

    // ── Sync reads (from in-memory cache) ────────────────────────────────────────

    static load() {
        return this._cache
    }

    // Legacy shim — updates in-memory cache only (API writes go through individual methods)
    static save(data) {
        this._cache = data
    }

    static getRules() { return this._cache.rules || {} }
    static getAmountRules() { return this._cache.amountRules || {} }
    static getCustomCategories() { return this._cache.categories || {} }

    static getIncomesByMonth(month, bank) {
        return this._cache.incomes.filter(i => i.month === month && i.bank === bank)
    }

    static getExpensesByMonth(month, bank) {
        return this._cache.expenses.filter(e => e.month === month && (bank == null || e.bank === bank))
    }

    static getEntreContasByMonth(month) {
        return this._cache.expenses.filter(e => e.month === month && e.sector === 'entre_contas')
    }

    static getBalance(month, bank) {
        return (this._cache.balances || {})[`${month}::${bank}`]
    }

    static getExpenseById(id) {
        return this._cache.expenses.find(e => String(e.id) === String(id)) || null
    }

    static getAliases() { return this._cache.aliases || {} }

    static getAlias(normalizedName) {
        return (this._cache.aliases || {})[normalizedName] || null
    }

    static getBanksWithData() {
        const banks = new Set()
        this._cache.incomes.forEach(i => { if (i.bank) banks.add(i.bank) })
        this._cache.expenses.forEach(e => { if (e.bank) banks.add(e.bank) })
        const order = ['nubank', 'inter', 'caixa', 'itau', 'bradesco', 'santander', 'bb', 'stone', 'original', 'generico']
        return [...banks].sort((a, b) => {
            const ia = order.indexOf(a), ib = order.indexOf(b)
            return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
        })
    }

    // Igual a getBanksWithData, mas exclui bancos que só têm placeholders de contas fixas
    static getBanksForNav() {
        const allBanks = this.getBanksWithData()
        return allBanks.filter(bank => {
            const hasIncome = this._cache.incomes.some(i => i.bank === bank)
            const hasRealExpense = this._cache.expenses.some(e =>
                e.bank === bank && !(e.externalId && e.externalId.startsWith('fixed:'))
            )
            return hasIncome || hasRealExpense
        })
    }

    static getRecentMonths() {
        const months = []
        const now = new Date()
        const baseYear = now.getFullYear()
        const baseMonth = now.getMonth()
        for (let i = 5; i >= 0; i--) {
            let mo = baseMonth - i
            let y = baseYear
            if (mo < 0) { mo += 12; y -= 1 }
            months.push(`${y}-${String(mo + 1).padStart(2, '0')}`)
        }
        return months
    }

    // ── Async writes (API + cache update) ─────────────────────────────────────────

    static async addIncome(income) {
        const payload = { month: income.month, name: income.name, amount: income.amount, bank: income.bank }
        if (income.dateStr) payload.dateStr = income.dateStr
        const created = await ApiClient.post('/api/incomes', payload)
        this._cache.incomes.push(this._normalizeIncome(created))
        return created
    }

    static async addExpense(expense) {
        const payload = {
            month: expense.month, name: expense.name, amount: expense.amount,
            type: expense.type || 'variavel', category: expense.category || null,
            sector: expense.sector || 'gasto', bank: expense.bank,
            isResgate: expense.resgate || false, isInternal: expense.internal || false,
        }
        if (expense.dateStr) payload.dateStr = expense.dateStr
        const created = await ApiClient.post('/api/expenses', payload)
        this._cache.expenses.push(this._normalizeExpense(created))
        return created
    }

    static async removeIncome(id) {
        await ApiClient.delete(`/api/incomes/${id}`)
        this._cache.incomes = this._cache.incomes.filter(i => String(i.id) !== String(id))
    }

    static async removeExpense(id) {
        await ApiClient.delete(`/api/expenses/${id}`)
        this._cache.expenses = this._cache.expenses.filter(e => String(e.id) !== String(id))
    }

    static async clearIncomesByMonth(month, bank) {
        await ApiClient.delete(`/api/incomes?month=${encodeURIComponent(month)}&bank=${encodeURIComponent(bank)}`)
        this._cache.incomes = this._cache.incomes.filter(i => !(i.month === month && i.bank === bank))
    }

    static async clearExpensesByMonth(month, bank) {
        await ApiClient.delete(`/api/expenses?month=${encodeURIComponent(month)}&bank=${encodeURIComponent(bank)}`)
        this._cache.expenses = this._cache.expenses.filter(e => !(e.month === month && e.bank === bank))
    }

    static async clearAllByBank(bank) {
        const months = [...new Set([
            ...this._cache.incomes.filter(i => i.bank === bank).map(i => i.month),
            ...this._cache.expenses.filter(e => e.bank === bank).map(e => e.month),
        ])]
        await Promise.all([
            ...months.map(m => ApiClient.delete(`/api/incomes?month=${encodeURIComponent(m)}&bank=${encodeURIComponent(bank)}`)),
            ...months.map(m => ApiClient.delete(`/api/expenses?month=${encodeURIComponent(m)}&bank=${encodeURIComponent(bank)}`)),
        ])
        this._cache.incomes = this._cache.incomes.filter(i => i.bank !== bank)
        this._cache.expenses = this._cache.expenses.filter(e => e.bank !== bank)
        Object.keys(this._cache.balances).forEach(k => { if (k.endsWith(`::${bank}`)) delete this._cache.balances[k] })
    }

    static async setBalance(month, bank, value) {
        await ApiClient.put('/api/balances', { month, bank, value })
        if (!this._cache.balances) this._cache.balances = {}
        this._cache.balances[`${month}::${bank}`] = value
    }

    static async setRule(memo, category) {
        await ApiClient.put('/api/rules', { memo: memo.toLowerCase(), category })
        if (!this._cache.rules) this._cache.rules = {}
        this._cache.rules[memo.toLowerCase()] = category
    }

    static async removeRule(memo) {
        const m = memo.toLowerCase()
        await ApiClient.delete(`/api/rules?memo=${encodeURIComponent(m)}`)
        if (this._cache.rules) delete this._cache.rules[m]
    }

    static async setAmountRule(normalizedName, amount, category) {
        await ApiClient.put('/api/amount-rules', { normalizedName, amount: Number(amount), category })
        if (!this._cache.amountRules) this._cache.amountRules = {}
        this._cache.amountRules[`${normalizedName}::${Number(amount).toFixed(2)}`] = category
    }

    static async removeAmountRule(normalizedName, amount) {
        await ApiClient.delete(`/api/amount-rules?normalizedName=${encodeURIComponent(normalizedName)}&amount=${amount}`)
        const key = `${normalizedName}::${Number(amount).toFixed(2)}`
        if (this._cache.amountRules) delete this._cache.amountRules[key]
    }

    static async addCustomCategory(key, label, color) {
        try {
            await ApiClient.post('/api/categories', { key, label, color: color || null })
        } catch (e) {
            if (e.status === 409) {
                await ApiClient.patch(`/api/categories/${key}`, { label, color: color || null })
            } else throw e
        }
        if (!this._cache.categories) this._cache.categories = {}
        const existing = this._cache.categories[key]
        this._cache.categories[key] = { label, color: color || null, isFixed: (existing || {}).isFixed || false }
    }

    static async renameCategory(key, newLabel) {
        if (!this._cache.categories) this._cache.categories = {}
        const existing = this._cache.categories[key]
        const color = (existing || {}).color || (typeof CAT_COLORS !== 'undefined' ? CAT_COLORS[key] : null) || '#888'

        // Update cache immediately preserving all existing fields
        this._cache.categories[key] = { label: newLabel, color, isFixed: (existing || {}).isFixed || false }

        // Sync to API
        if (existing) {
            await ApiClient.patch(`/api/categories/${key}`, { label: newLabel }).catch(async e => {
                if (e.status === 404) {
                    // Cache estava desatualizado — categoria não existe no banco, criar
                    await ApiClient.post('/api/categories', { key, label: newLabel, color }).catch(async e2 => {
                        if (e2.status === 409) await ApiClient.patch(`/api/categories/${key}`, { label: newLabel })
                        else throw e2
                    })
                } else throw e
            })
        } else {
            await ApiClient.post('/api/categories', { key, label: newLabel, color }).catch(async e => {
                if (e.status === 409) await ApiClient.patch(`/api/categories/${key}`, { label: newLabel })
                else throw e
            })
        }
    }

    static async updateExpenseCategory(id, category) {
        await ApiClient.patch(`/api/expenses/${id}`, { category })
        const expense = this._cache.expenses.find(e => String(e.id) === String(id))
        if (expense) expense.category = category
    }

    static async bulkUpdateExpenseCategories(memoLower, newCat) {
        // Exclui transações com 📌 Fixar valor — o pin é mais específico que a regra por memo
        const amountRules = this._cache.amountRules || {}
        const isPinned = e => !!amountRules[`${Classifier._normalizeKey(e.name)}::${e.amount.toFixed(2)}`]
        const toUpdate = this._cache.expenses.filter(
            e => e.name.toLowerCase() === memoLower && e.category !== newCat && !isPinned(e)
        )
        await Promise.all(toUpdate.map(e => ApiClient.patch(`/api/expenses/${e.id}`, { category: newCat })))
        toUpdate.forEach(e => { e.category = newCat })
    }

    static async setAlias(normalizedName, alias) {
        await ApiClient.put('/api/aliases', { normalizedName, alias })
        if (!this._cache.aliases) this._cache.aliases = {}
        this._cache.aliases[normalizedName] = alias
    }

    static async removeAlias(normalizedName) {
        await ApiClient.delete(`/api/aliases?normalizedName=${encodeURIComponent(normalizedName)}`)
        if (this._cache.aliases) delete this._cache.aliases[normalizedName]
    }

    static async importBatch(transactions, bank, saldoFinal, saldoMonth) {
        const VALID_SECTORS = ['gasto', 'investido', 'entre_contas']
        const payload = {
            transactions: transactions.map(t => ({
                month: t.month,
                name: t.memo,
                amount: t.amount,
                isIncome: !!(t.isIncome && !t.resgate),
                isResgate: t.resgate || false,
                isInternal: t.internal || false,
                sector: t.internal ? 'entre_contas' : (VALID_SECTORS.includes(t.sector) ? t.sector : 'gasto'),
                category: t.category || null,
                type: t.expType || 'variavel',
                bank,
                ...(t.dateStr && { dateStr: t.dateStr }),
            })),
            bank,
            ...(saldoFinal != null && { saldoFinal }),
            ...(saldoMonth && { saldoMonth }),
        }
        const result = await ApiClient.post('/api/import', payload)
        // Reload full cache since import may have created many records
        await this._loadAll()
        return result
    }

    // ─── Conexões bancárias (Pluggy) ────────────────────────────────────────

    static async getConnections() {
        return ApiClient.get('/api/connections')
    }

    static async getConnectToken() {
        return ApiClient.post('/api/connections/token', {})
    }

    static async saveConnection(itemId, connectorName) {
        return ApiClient.post('/api/connections', { itemId, connectorName: connectorName || '' })
    }

    static async syncConnection(itemId) {
        const result = await ApiClient.post(`/api/connections/${encodeURIComponent(itemId)}/sync`, {})
        await this._loadAll()
        return result
    }

    static async deleteConnection(itemId) {
        return ApiClient.delete(`/api/connections/${encodeURIComponent(itemId)}`)
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLASS: BankDetector — identifica o banco pelo conteúdo do arquivo

window.DataStore = DataStore
