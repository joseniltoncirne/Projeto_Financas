// ═══════════════════════════════════════════════════════════════════════════════
// FinanceApp — coordenador principal
// Os métodos de UI estão em módulos separados carregados após este arquivo:
//   CategoryDetailUI.js, CategoryManagerUI.js, ImportUI.js
// ═══════════════════════════════════════════════════════════════════════════════
class FinanceApp {
    constructor() {
        this.currentMonth = new Date().toISOString().slice(0, 7)
        this.currentTab = 'resumo'
        this.currentBank = null
        this.showIncForm = false
        this.showExpForm = false
        this.barChart = null
        this.pieChart = null
        this.overviewChart = null
        this.overviewChart2 = null
        this.geralDetailBank = null
        this.importer = new ImportService()
        this.importPending = []
        this.currentUser = null
        this._bulkPending = null
    }

    // ── Inicialização ───────────────────────────────────────────────────────────
    init() {
        document.getElementById('modal-overlay').classList.add('hidden')
        document.getElementById('detail-overlay').classList.add('hidden')
        this._syncCustomCategories()
        this._restoreViewState()
        this._updateCurrentBank()
        this.render()
        // Sincroniza estado visual das abas se foi restaurado algo != default
        if (this.currentTab !== 'resumo') this.switchTab(this.currentTab)
        this.initBankConnections()
    }

    // ── Persistência de view (banco + aba + detail bank) ────────────────────────
    _viewStateKey() {
        const uid = this.currentUser?.id
        return uid ? `mf_view_${uid}` : null
    }

    _saveViewState() {
        const k = this._viewStateKey()
        if (!k) return
        try {
            localStorage.setItem(k, JSON.stringify({
                bank: this.currentBank,
                tab: this.currentTab,
                geralDetailBank: this.geralDetailBank,
            }))
        } catch { /* quota cheio, ignora */ }
    }

    _restoreViewState() {
        const k = this._viewStateKey()
        if (!k) return
        try {
            const saved = JSON.parse(localStorage.getItem(k) || 'null')
            if (!saved) return
            if (saved.bank) this.currentBank = saved.bank
            if (saved.tab) this.currentTab = saved.tab
            if (saved.geralDetailBank) this.geralDetailBank = saved.geralDetailBank
        } catch { /* JSON inválido, ignora */ }
    }

    // ── Banco / navegação ───────────────────────────────────────────────────────
    _updateCurrentBank() {
        const banks = DataStore.getBanksWithData()
        const realBanks = banks.filter(b => b !== 'entre_contas')
        if (!banks.length) { this.currentBank = null; this.geralDetailBank = null; return }
        if (this.currentBank === 'geral') {
            if (!this.geralDetailBank || !realBanks.includes(this.geralDetailBank))
                this.geralDetailBank = realBanks[0] || null
            return
        }
        if (!this.currentBank || !banks.includes(this.currentBank)) {
            this.currentBank = realBanks.length > 1 ? 'geral' : realBanks[0]
            if (this.currentBank === 'geral')
                this.geralDetailBank = realBanks[0] || null
        }
    }

    switchBank(bank) {
        if (bank === 'entre_contas') { this.openEntreContasModal(); return }
        // Minhas Contas só existe no Geral — sempre volta para Resumo ao trocar de banco
        this.currentTab = 'resumo'
        this.currentBank = bank
        this.showIncForm = false
        this.showExpForm = false
        this._saveViewState()
        this.render()
    }

    switchGeralDetailBank(bank) {
        this.geralDetailBank = bank
        this.showIncForm = false
        this.showExpForm = false
        this._saveViewState()
        this.render()
    }

    switchTab(tab) {
        this.currentTab = tab
        this.showIncForm = false
        this.showExpForm = false
        this._saveViewState()

        if (this.currentBank === 'geral') {
            const isAnalise = tab === 'analise'
            document.getElementById('sec-overview').style.display = isAnalise ? 'none' : ''
            document.getElementById('sec-analise').style.display = isAnalise ? 'block' : 'none'
            if (isAnalise) setTimeout(() => this.renderChecklist(), 50)
            return
        }

        // Banco específico: apenas Resumo / Entradas / Saídas
        document.querySelectorAll('#bank-sections .tab').forEach((b, i) => {
            b.classList.toggle('active', ['resumo', 'rendas', 'gastos'][i] === tab)
        })
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'))
        document.getElementById('sec-' + tab).classList.add('active')
        this.render()
    }

    shiftMonth(dir) {
        const [y, mo] = this.currentMonth.split('-').map(Number)
        if (dir < 0) this.currentMonth = mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`
        else this.currentMonth = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`
        this.showIncForm = false
        this.showExpForm = false
        this.render()
        if (this.currentTab === 'analise') setTimeout(() => this.renderChecklist(), 50)
    }

    // ── Render ──────────────────────────────────────────────────────────────────
    render() {
        document.getElementById('month-label').textContent = Renderer.monthLabel(this.currentMonth)
        const navBanks = DataStore.getBanksForNav()
        this._updateCurrentBank()
        Renderer.renderBankNav(navBanks, this.currentBank)
        Renderer.renderOverview(this.currentMonth, navBanks, this.currentBank)
        setTimeout(() => this._renderOverviewChart(), 50)
        setTimeout(() => this._updateContasBadge(), 50)
        if (!this.currentBank) {
            document.getElementById('sec-overview').style.display = 'none'
            document.getElementById('sec-analise').style.display = 'none'
            document.getElementById('bank-sections').style.display = 'block'
            document.getElementById('sec-resumo').innerHTML = '<div class="bank-empty"><span class="bank-empty-icon">🏦</span>Importe um extrato para começar.<br><span style="font-size:12px">Arraste um arquivo .CSV, .OFX ou .PDF acima.</span></div>'
            document.getElementById('sec-rendas').innerHTML = ''
            document.getElementById('sec-gastos').innerHTML = ''
            return
        }

        if (this.currentBank === 'geral') {
            const isAnalise = this.currentTab === 'analise'
            document.getElementById('sec-overview').style.display = isAnalise ? 'none' : ''
            document.getElementById('sec-analise').style.display = isAnalise ? 'block' : 'none'
            document.getElementById('bank-sections').style.display = 'none'
            if (isAnalise) setTimeout(() => this.renderChecklist(), 50)
            return
        }

        // Banco específico — Minhas Contas não existe aqui
        document.getElementById('sec-overview').style.display = 'none'
        document.getElementById('sec-analise').style.display = 'none'
        document.getElementById('detail-bank-picker').innerHTML = ''
        document.getElementById('bank-sections').style.display = 'block'
        Renderer.renderSummary(this.currentMonth, this.currentBank)
        Renderer.renderIncomes(this.currentMonth, this.currentBank, this.showIncForm)
        Renderer.renderExpenses(this.currentMonth, this.currentBank, this.showExpForm)
    }

    _renderDetailBankPicker(banks) {
        const picker = document.getElementById('detail-bank-picker')
        if (!picker) return
        const realBanks = banks.filter(b => b !== 'entre_contas')
        if (realBanks.length <= 1) { picker.innerHTML = ''; return }
        picker.innerHTML = `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:1rem">
          ${realBanks.map(b => {
              const meta = BANK_META[b] || BANK_META.generico
              const active = b === this.geralDetailBank
              return `<button style="display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:20px;border:1.5px solid ${meta.color};font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;${active ? `background:${meta.color};color:#fff` : `background:transparent;color:${meta.color}`}" onclick="app.switchGeralDetailBank('${b}')">${meta.logo} ${meta.label}</button>`
          }).join('')}
        </div>`
    }

    async _updateContasBadge() {
        const badge = document.getElementById('contas-badge')
        if (!badge) return
        try {
            const month = this.currentMonth
            const items = await ApiClient.get(`/api/fixed-expenses?month=${month}`)
            const hasUnpaid = items.some(i => !i.payments.some(p => p.month === month))
            badge.style.display = hasUnpaid ? 'block' : 'none'
        } catch {
            badge.style.display = 'none'
        }
    }

    _renderOverviewChart() {
        if (this.overviewChart) { this.overviewChart.destroy(); this.overviewChart = null }
        if (this.overviewChart2) { this.overviewChart2.destroy(); this.overviewChart2 = null }
        const banks = DataStore.getBanksForNav()
        const month = this.currentMonth
        const mkChart = (elId, valueKey) => {
            const el = document.getElementById(elId)
            if (!el) return null
            const items = banks
                .filter(b => b !== 'entre_contas')
                .map(bank => {
                    const meta = BANK_META[bank] || BANK_META.generico
                    const rows = DataStore.getExpensesByMonth(month, bank)
                        .filter(e => !(e.externalId && e.externalId.startsWith('fixed:')))
                    let value = 0
                    if (valueKey === 'gasto') {
                        value = rows.filter(e => Classifier.sectorOf(e) === 'gasto' && e.sector !== 'entre_contas').reduce((s, e) => s + e.amount, 0)
                    } else {
                        const aplic = rows.filter(e => Classifier.sectorOf(e) === 'investido' && !e.resgate).reduce((s, e) => s + e.amount, 0)
                        const resg = rows.filter(e => Classifier.sectorOf(e) === 'investido' && e.resgate).reduce((s, e) => s + e.amount, 0)
                        value = aplic - resg
                    }
                    return { label: `${meta.icon} ${meta.label}`, color: meta.color, value: Math.max(0, value) }
                })
            if (!items.some(i => i.value > 0)) return null
            return new Chart(el, {
                type: 'doughnut',
                data: {
                    labels: items.map(i => i.label),
                    datasets: [{ data: items.map(i => i.value), backgroundColor: items.map(i => i.color), borderWidth: 0, hoverOffset: 6 }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, cutout: '65%',
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${Renderer.fmt(ctx.raw)}` } }
                    }
                }
            })
        }
        this.overviewChart = mkChart('overviewDonutGasto', 'gasto')
        this.overviewChart2 = mkChart('overviewDonutInvest', 'investido')
    }

    _renderCharts() {
        const bank = this.currentBank === 'geral' ? this.geralDetailBank : this.currentBank
        const result = Renderer.renderCharts(this.currentMonth, bank, this.barChart, this.pieChart)
        this.barChart = result.barChart
        this.pieChart = result.pieChart
    }

    // ── Formulários ─────────────────────────────────────────────────────────────
    toggleIncForm() { this.showIncForm = !this.showIncForm; this.render() }
    toggleExpForm() { this.showExpForm = !this.showExpForm; this.render() }

    async addIncome() {
        const name = document.getElementById('inc-name').value.trim()
        const amount = parseFloat(document.getElementById('inc-amount').value)
        if (!name || !amount || amount <= 0) {
            this._showToast('Preencha nome e valor!', 'toast-error')
            return
        }
        try {
            await DataStore.addIncome({ month: this.currentMonth, name, amount, bank: this.currentBank })
            this.showIncForm = false
            this.render()
        } catch (e) {
            this._showToast('Erro ao adicionar renda.', 'toast-error')
        }
    }

    // Pré-seleciona a categoria com base nas regras existentes (memo + amount)
    // Só atua se o usuário ainda não tocou no select manualmente.
    _suggestExpenseCategory() {
        const sel = document.getElementById('exp-cat')
        if (!sel || sel.dataset.userTouched === '1') return
        const name = document.getElementById('exp-name')?.value.trim() || ''
        if (name.length < 2) return
        const amount = parseFloat(document.getElementById('exp-amount')?.value || '0') || undefined
        const suggested = Classifier._categoryWithRules(
            name,
            DataStore.getRules(),
            DataStore.getAmountRules(),
            amount,
        )
        if (suggested && [...sel.options].some(o => o.value === suggested) && sel.value !== suggested) {
            sel.value = suggested
        }
    }

    async addExpense() {
        const name = document.getElementById('exp-name').value.trim()
        const amount = parseFloat(document.getElementById('exp-amount').value)
        const sector = document.getElementById('exp-sector').value
        const type = document.getElementById('exp-type').value
        const category = document.getElementById('exp-cat').value
        if (!name || !amount || amount <= 0) {
            this._showToast('Preencha nome e valor!', 'toast-error')
            return
        }
        try {
            await DataStore.addExpense({ month: this.currentMonth, name, amount, type, category, sector, bank: this.currentBank })
            this.showExpForm = false
            this.render()
        } catch (e) {
            this._showToast('Erro ao adicionar gasto.', 'toast-error')
        }
    }

    async removeIncome(id) {
        const income = DataStore.load().incomes.find(i => String(i.id) === String(id))
        const confirmed = await this._showConfirmModal({
            title: 'Remover renda',
            message: income ? `Remover <strong>${Renderer.esc(income.name)}</strong> (${Renderer.fmt(income.amount)})?` : 'Remover esta renda?',
            confirmLabel: 'Remover',
            dangerous: true,
        })
        if (!confirmed) return
        try {
            await DataStore.removeIncome(id)
            this.render()
        } catch (e) {
            this._showToast('Erro ao remover renda.', 'toast-error')
        }
    }

    async removeExpense(id) {
        const expense = DataStore.getExpenseById(id)
        const confirmed = await this._showConfirmModal({
            title: 'Remover gasto',
            message: expense ? `Remover <strong>${Renderer.esc(expense.name)}</strong> (${Renderer.fmt(expense.amount)})?` : 'Remover este gasto?',
            confirmLabel: 'Remover',
            dangerous: true,
        })
        if (!confirmed) return
        try {
            await DataStore.removeExpense(id)
            this.render()
        } catch (e) {
            this._showToast('Erro ao remover gasto.', 'toast-error')
        }
    }

    async clearIncomes() {
        const [y, mo] = this.currentMonth.split('-')
        const confirmed = await this._showConfirmModal({
            title: 'Limpar rendas',
            message: `Remover <strong>todas as rendas</strong> de ${MONTH_NAMES[parseInt(mo) - 1]} ${y}?`,
            confirmLabel: 'Remover todas',
            dangerous: true,
        })
        if (!confirmed) return
        try {
            await DataStore.clearIncomesByMonth(this.currentMonth, this.currentBank)
            this.render()
        } catch (e) {
            this._showToast('Erro ao limpar rendas.', 'toast-error')
        }
    }

    async clearExpenses() {
        const [y, mo] = this.currentMonth.split('-')
        const confirmed = await this._showConfirmModal({
            title: 'Limpar movimentações',
            message: `Remover <strong>todas as movimentações</strong> de ${MONTH_NAMES[parseInt(mo) - 1]} ${y}?`,
            confirmLabel: 'Remover todas',
            dangerous: true,
        })
        if (!confirmed) return
        try {
            await DataStore.clearExpensesByMonth(this.currentMonth, this.currentBank)
            this.render()
        } catch (e) {
            this._showToast('Erro ao limpar movimentações.', 'toast-error')
        }
    }

    // ── Saldo em conta ──────────────────────────────────────────────────────────
    async editBalance(month, bank) {
        const b = bank || this.currentBank
        const current = DataStore.getBalance(month, b)
        const [y, mo] = month.split('-')
        const meta = BANK_META[b] || BANK_META.generico
        const label = `${MONTH_NAMES[parseInt(mo) - 1]} ${y} — ${meta.label}`

        const raw = await this._showInputModal({
            title: '🏦 Saldo em conta',
            subtitle: label,
            label: 'Saldo final do período',
            placeholder: '0,00',
            defaultValue: current !== undefined ? current.toFixed(2).replace('.', ',') : '',
            hint: 'Valor "Saldo final do período" do extrato',
            confirmLabel: 'Salvar',
        })
        if (raw === null) return
        const val = parseFloat(raw.replace(/\./g, '').replace(',', '.'))
        if (isNaN(val)) {
            this._showToast('Valor inválido.', 'toast-error')
            return
        }
        try {
            await DataStore.setBalance(month, b, val)
            this.render()
        } catch (e) {
            this._showToast('Erro ao salvar saldo.', 'toast-error')
        }
    }

    // ── Toast ───────────────────────────────────────────────────────────────────
    _showToast(msg, type = 'toast-success', actionsArg = null) {
        let el = document.getElementById('app-toast')
        if (!el) {
            el = document.createElement('div')
            el.id = 'app-toast'
            el.className = 'toast'
            document.body.appendChild(el)
        }
        // Aceita um único action ou array
        const actions = Array.isArray(actionsArg) ? actionsArg : (actionsArg ? [actionsArg] : [])
        const hasActions = actions.length > 0
        const duration = hasActions ? 8000 : 3000
        el.className = `toast ${type}${hasActions ? ' toast-with-action' : ''}`
        el.innerHTML = ''
        const textEl = document.createElement('span')
        textEl.className = 'toast-text'
        textEl.textContent = msg
        el.appendChild(textEl)
        if (hasActions) {
            const btnWrap = document.createElement('div')
            btnWrap.className = 'toast-actions'
            actions.forEach(a => {
                if (typeof a.onClick !== 'function') return
                const btn = document.createElement('button')
                btn.type = 'button'
                btn.className = `toast-action${a.primary ? ' toast-action-primary' : ''}`
                btn.textContent = a.label || 'OK'
                btn.addEventListener('click', () => {
                    clearTimeout(this._toastTimer)
                    el.classList.remove('show')
                    a.onClick()
                })
                btnWrap.appendChild(btn)
            })
            el.appendChild(btnWrap)
        }
        clearTimeout(this._toastTimer)
        void el.offsetWidth
        el.classList.add('show')
        this._toastTimer = setTimeout(() => el.classList.remove('show'), duration)
    }

    // ── Loading overlay ─────────────────────────────────────────────────────────
    _setLoading(isLoading, msg = 'Aguarde...') {
        let el = document.getElementById('app-loading-overlay')
        if (isLoading) {
            if (!el) {
                el = document.createElement('div')
                el.id = 'app-loading-overlay'
                el.className = 'app-loading-overlay'
                el.innerHTML = `<div class="app-loading-box">
                    <div class="app-loading-spinner"></div>
                    <span id="app-loading-msg">${msg}</span>
                </div>`
                document.body.appendChild(el)
            } else {
                const msgEl = el.querySelector('#app-loading-msg')
                if (msgEl) msgEl.textContent = msg
            }
        } else {
            el?.remove()
        }
    }

    // ── Modais genéricos (substituem prompt / confirm nativos) ──────────────────
    _showInputModal({ title, subtitle = '', label = '', placeholder = '', defaultValue = '', hint = '', confirmLabel = 'Salvar' }) {
        return new Promise(resolve => {
            const overlay = document.createElement('div')
            overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(2px)'

            const box = document.createElement('div')
            box.style.cssText = 'background:var(--surface);border-radius:16px;padding:24px;width:100%;max-width:360px;box-shadow:0 20px 60px rgba(0,0,0,0.25)'

            box.innerHTML = `
                <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:6px">${title}</div>
                ${subtitle ? `<div style="font-size:11px;color:var(--text3);margin-bottom:16px;padding:8px 10px;background:var(--bg);border-radius:8px">${subtitle}</div>` : ''}
                ${label ? `<label style="font-size:12px;font-weight:600;color:var(--text2);display:block;margin-bottom:6px">${label}</label>` : ''}
                <input id="_inp_val" type="text" placeholder="${placeholder}" value="${Renderer.esc(String(defaultValue))}"
                    style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;color:var(--text);background:var(--surface);outline:none;margin-bottom:${hint ? '6px' : '16px'};transition:border-color .15s">
                ${hint ? `<div style="font-size:11px;color:var(--text3);margin-bottom:16px">${hint}</div>` : ''}
                <div style="display:flex;gap:8px">
                    <button id="_inp_cancel" style="flex:1;padding:10px;border:1.5px solid var(--border);border-radius:8px;background:transparent;color:var(--text2);font-size:14px;cursor:pointer;font-weight:500">Cancelar</button>
                    <button id="_inp_save" style="flex:1;padding:10px;border:none;border-radius:8px;background:#0ea5e9;color:#fff;font-size:14px;font-weight:600;cursor:pointer">${confirmLabel}</button>
                </div>
            `

            overlay.appendChild(box)
            document.body.appendChild(overlay)

            const input = box.querySelector('#_inp_val')
            input.focus()
            input.select()
            input.addEventListener('focus', () => { input.style.borderColor = '#0ea5e9' })
            input.addEventListener('blur', () => { input.style.borderColor = '' })

            const close = (val) => { document.body.removeChild(overlay); resolve(val) }
            overlay.addEventListener('click', e => { if (e.target === overlay) close(null) })
            box.querySelector('#_inp_cancel').addEventListener('click', () => close(null))
            box.querySelector('#_inp_save').addEventListener('click', () => close(input.value))
            input.addEventListener('keydown', e => {
                if (e.key === 'Enter') close(input.value)
                if (e.key === 'Escape') close(null)
            })
        })
    }

    _openModal(html) {
        if (this._modalOverlay) this._closeModal()
        const overlay = document.createElement('div')
        overlay.className = 'modal-overlay'
        overlay.style.zIndex = '9000'
        const box = document.createElement('div')
        box.className = 'modal'
        box.style.maxWidth = '520px'
        box.innerHTML = html
        overlay.appendChild(box)
        document.body.appendChild(overlay)
        this._modalOverlay = overlay
        const handler = (e) => {
            if (e.key === 'Escape') { document.removeEventListener('keydown', handler); this._closeModal() }
        }
        this._modalKeyHandler = handler
        document.addEventListener('keydown', handler)
        overlay.addEventListener('click', e => { if (e.target === overlay) this._closeModal() })
    }

    _closeModal() {
        if (this._modalOverlay) {
            document.body.removeChild(this._modalOverlay)
            this._modalOverlay = null
        }
        if (this._modalKeyHandler) {
            document.removeEventListener('keydown', this._modalKeyHandler)
            this._modalKeyHandler = null
        }
    }

    _showConfirmModal({ title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', dangerous = false }) {
        return new Promise(resolve => {
            const overlay = document.createElement('div')
            overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(2px)'

            const box = document.createElement('div')
            box.style.cssText = 'background:var(--surface);border-radius:16px;padding:24px;width:100%;max-width:360px;box-shadow:0 20px 60px rgba(0,0,0,0.25)'

            const confirmBg = dangerous ? '#ef4444' : '#0ea5e9'

            box.innerHTML = `
                <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:10px">${title}</div>
                <div style="font-size:13px;color:var(--text2);margin-bottom:20px;line-height:1.5">${message}</div>
                <div style="display:flex;gap:8px">
                    <button id="_conf_cancel" style="flex:1;padding:10px;border:1.5px solid var(--border);border-radius:8px;background:transparent;color:var(--text2);font-size:14px;cursor:pointer;font-weight:500">${cancelLabel}</button>
                    <button id="_conf_ok" style="flex:1;padding:10px;border:none;border-radius:8px;background:${confirmBg};color:#fff;font-size:14px;font-weight:600;cursor:pointer">${confirmLabel}</button>
                </div>
            `

            overlay.appendChild(box)
            document.body.appendChild(overlay)

            const close = (val) => { document.body.removeChild(overlay); resolve(val) }
            overlay.addEventListener('click', e => { if (e.target === overlay) close(false) })
            box.querySelector('#_conf_cancel').addEventListener('click', () => close(false))
            box.querySelector('#_conf_ok').addEventListener('click', () => close(true))

            const handler = (e) => {
                if (e.key === 'Escape') { document.removeEventListener('keydown', handler); close(false) }
                if (e.key === 'Enter') { document.removeEventListener('keydown', handler); close(true) }
            }
            document.addEventListener('keydown', handler)
        })
    }
}

window.FinanceApp = FinanceApp
