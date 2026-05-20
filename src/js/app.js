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
        this._updateCurrentBank()
        this.render()
    }

    _syncCustomCategories() {
        // Reset para os valores base antes de aplicar customizações do usuário atual.
        // Sem isso, categorias do usuário A vazariam para o usuário B na mesma sessão de página.
        Object.keys(CAT_LABELS).forEach(k => { if (!(k in BASE_CAT_LABELS)) delete CAT_LABELS[k] })
        Object.assign(CAT_LABELS, BASE_CAT_LABELS)
        Object.keys(CAT_COLORS).forEach(k => { if (!(k in BASE_CAT_COLORS)) delete CAT_COLORS[k] })
        Object.assign(CAT_COLORS, BASE_CAT_COLORS)
        const custom = DataStore.getCustomCategories()
        const emojiRe = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u
        for (const [key, cat] of Object.entries(custom)) {
            let label = cat.label
            // Auto-corrige categorias salvas sem emoji (ex: "Estacionamento" → "🅿️ Estacionamento")
            if (!emojiRe.test(label)) {
                const emoji = this._emojiForName(label)
                label = `${emoji} ${label}`
                DataStore.renameCategory(key, label)
            }
            CAT_LABELS[key] = label
            CAT_COLORS[key] = cat.color
        }
    }

    // Escolhe emoji com base em palavras-chave do nome da categoria
    _emojiForName(name) {
        const n = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        const map = [
            ['⛽', ['gasolina', 'combustivel', 'etanol', 'alcool combust', 'diesel', 'posto combustiv', 'abastec']],
            ['🅿️', ['estacionamento', 'parking', 'zona azul', 'vaga']],
            ['🏠', ['moradia', 'aluguel', 'condominio', 'iptu', 'casa', 'apartamento', 'energia elet', 'conta de luz', 'agua', 'gas encanado', 'internet', 'banda larga']],
            ['🍽️', ['alimentacao', 'alimenta', 'comida', 'refeicao', 'restaurante', 'lanche', 'mercado', 'supermercado', 'padaria', 'ifood', 'delivery', 'pizza', 'sushi']],
            ['🚗', ['transporte', 'uber', 'taxi', 'corrida', 'onibus', 'metro', 'pedagio', 'passagem']],
            ['💊', ['saude', 'farmacia', 'medico', 'hospital', 'plano de saude', 'consulta', 'dentista', 'exame', 'remedio']],
            ['📚', ['educacao', 'escola', 'faculdade', 'curso', 'livro', 'papelaria', 'treinamento']],
            ['🎮', ['lazer', 'entretenimento', 'netflix', 'spotify', 'cinema', 'jogo', 'game', 'streaming', 'serie']],
            ['💳', ['cartao', 'fatura', 'credito']],
            ['🐾', ['pet', 'animal', 'veterinario', 'cachorro', 'gato', 'racao']],
            ['👗', ['roupa', 'vestuario', 'moda', 'calcado', 'sapato', 'tenis', 'camisa']],
            ['✈️', ['viagem', 'passagem aer', 'hotel', 'hospedagem', 'turismo', 'airbnb']],
            ['🏋️', ['academia', 'fitness', 'gym', 'esporte', 'pilates', 'crossfit']],
            ['🎁', ['presente', 'gift', 'doacao', 'brinde']],
            ['🔧', ['manutencao', 'reparo', 'conserto', 'mecanico', 'oficina', 'reforma']],
            ['📱', ['celular', 'telefone', 'smartphone', 'plano cel']],
            ['💰', ['investimento', 'poupanca', 'aplicacao', 'reserva', 'rendimento']],
            ['🏦', ['banco', 'financeiro', 'emprestimo', 'financiamento']],
            ['🛒', ['compras', 'shopping', 'loja', 'magazine']],
        ]
        for (const [emoji, keywords] of map) {
            if (keywords.some(k => n.includes(k))) return emoji
        }
        return '📦'
    }

    _slugify(str) {
        return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'custom'
    }

    _nextCustomColor() {
        const palette = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#84cc16', '#a855f7', '#06b6d4']
        const count = Object.keys(DataStore.getCustomCategories()).length
        return palette[count % palette.length]
    }

    async _createCustomCategory() {
        const name = prompt('Nome da nova categoria:')
        if (!name || !name.trim()) return null
        const trimmed = name.trim()
        const key = this._slugify(trimmed)
        if (!key) return null
        const color = this._nextCustomColor()
        const emoji = this._emojiForName(trimmed)
        await DataStore.addCustomCategory(key, `${emoji} ${trimmed}`, color)
        this._syncCustomCategories()
        return key
    }

    // Picks first available bank, or keeps currentBank if still valid
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
        this.currentBank = bank
        this.showIncForm = false
        this.showExpForm = false
        this.render()
    }

    switchGeralDetailBank(bank) {
        this.geralDetailBank = bank
        this.showIncForm = false
        this.showExpForm = false
        this.render()
    }

    // ── Navegação ───────────────────────────────────────────────────────────────
    switchTab(tab) {
        this.currentTab = tab
        this.showIncForm = false
        this.showExpForm = false
        document.querySelectorAll('.tab').forEach((b, i) => {
            b.classList.toggle('active', ['resumo', 'rendas', 'gastos', 'analise'][i] === tab)
        })
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'))
        document.getElementById('sec-' + tab).classList.add('active')
        this.render()
        if (tab === 'analise') setTimeout(() => this._renderCharts(), 50)
    }

    shiftMonth(dir) {
        const [y, mo] = this.currentMonth.split('-').map(Number)
        if (dir < 0) this.currentMonth = mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`
        else this.currentMonth = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`
        this.showIncForm = false
        this.showExpForm = false
        this.render()
        if (this.currentTab === 'analise') setTimeout(() => this._renderCharts(), 50)
    }

    // ── Render ──────────────────────────────────────────────────────────────────
    render() {
        document.getElementById('month-label').textContent = Renderer.monthLabel(this.currentMonth)
        const banks = DataStore.getBanksWithData()
        this._updateCurrentBank()
        Renderer.renderBankNav(banks, this.currentBank)
        Renderer.renderOverview(this.currentMonth, banks, this.currentBank)
        setTimeout(() => this._renderOverviewChart(), 50)
        if (!this.currentBank) {
            document.getElementById('sec-overview').innerHTML = ''
            document.getElementById('bank-sections').style.display = 'block'
            document.getElementById('sec-resumo').innerHTML = '<div class="bank-empty"><span class="bank-empty-icon">🏦</span>Importe um extrato para começar.<br><span style="font-size:12px">Arraste um arquivo .CSV, .OFX ou .PDF acima.</span></div>'
            document.getElementById('sec-rendas').innerHTML = ''
            document.getElementById('sec-gastos').innerHTML = ''
            document.getElementById('sec-analise').innerHTML = ''
            return
        }

        if (this.currentBank === 'geral') {
            document.getElementById('bank-sections').style.display = 'none'
            return
        }

        document.getElementById('detail-bank-picker').innerHTML = ''
        document.getElementById('bank-sections').style.display = 'block'
        Renderer.renderSummary(this.currentMonth, this.currentBank)
        Renderer.renderIncomes(this.currentMonth, this.currentBank, this.showIncForm)
        Renderer.renderExpenses(this.currentMonth, this.currentBank, this.showExpForm)
        Renderer.renderAnalysis(this.currentMonth, this.currentBank)
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

    _renderOverviewChart() {
        if (this.overviewChart) { this.overviewChart.destroy(); this.overviewChart = null }
        if (this.overviewChart2) { this.overviewChart2.destroy(); this.overviewChart2 = null }

        const banks = DataStore.getBanksWithData()
        const month = this.currentMonth
        const mkChart = (elId, valueKey) => {
            const el = document.getElementById(elId)
            if (!el) return null
            const items = banks
                .filter(b => b !== 'entre_contas')
                .map(bank => {
                    const meta = BANK_META[bank] || BANK_META.generico
                    const rows = DataStore.getExpensesByMonth(month, bank)
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
        if (!name || !amount || amount <= 0) { alert('Preencha nome e valor!'); return }
        await DataStore.addIncome({ month: this.currentMonth, name, amount, bank: this.currentBank })
        this.showIncForm = false
        this.render()
    }

    async addExpense() {
        const name = document.getElementById('exp-name').value.trim()
        const amount = parseFloat(document.getElementById('exp-amount').value)
        const sector = document.getElementById('exp-sector').value
        const type = document.getElementById('exp-type').value
        const category = document.getElementById('exp-cat').value
        if (!name || !amount || amount <= 0) { alert('Preencha nome e valor!'); return }
        await DataStore.addExpense({ month: this.currentMonth, name, amount, type, category, sector, bank: this.currentBank })
        this.showExpForm = false
        this.render()
    }

    async removeIncome(id) {
        if (!confirm('Remover esta renda?')) return
        await DataStore.removeIncome(id)
        this.render()
    }

    async removeExpense(id) {
        if (!confirm('Remover este gasto?')) return
        await DataStore.removeExpense(id)
        this.render()
    }

    async clearIncomes() {
        const [y, mo] = this.currentMonth.split('-')
        if (!confirm(`Remover todas as rendas de ${MONTH_NAMES[parseInt(mo) - 1]} ${y}?`)) return
        await DataStore.clearIncomesByMonth(this.currentMonth, this.currentBank)
        this.render()
    }

    async clearExpenses() {
        const [y, mo] = this.currentMonth.split('-')
        if (!confirm(`Remover todas as movimentações de ${MONTH_NAMES[parseInt(mo) - 1]} ${y}?`)) return
        await DataStore.clearExpensesByMonth(this.currentMonth, this.currentBank)
        this.render()
    }

    // ── Saldo em conta ──────────────────────────────────────────────────────────
    async editBalance(month, bank) {
        const b = bank || this.currentBank
        const current = DataStore.getBalance(month, b)
        const [y, mo] = month.split('-')
        const meta = BANK_META[b] || BANK_META.generico
        const label = `${MONTH_NAMES[parseInt(mo) - 1]} ${y} — ${meta.label}`
        const input = prompt(`Saldo em conta — ${label}\n(valor "Saldo final do período" do extrato)`,
            current !== undefined ? current.toFixed(2).replace('.', ',') : '')
        if (input === null) return
        const val = parseFloat(input.replace(/\./g, '').replace(',', '.'))
        if (isNaN(val)) { alert('Valor inválido.'); return }
        await DataStore.setBalance(month, b, val)
        this.render()
    }

    // ── Modal de detalhe do setor ───────────────────────────────────────────────
    showSectorDetail(sector) {
        const items = DataStore.getExpensesByMonth(this.currentMonth, this.currentBank).filter(e => Classifier.sectorOf(e) === sector)
        const [y, mo] = this.currentMonth.split('-')
        const monthName = `${MONTH_NAMES[parseInt(mo) - 1]} ${y}`
        const isInvest = sector === 'investido'
        const aplicacoes = isInvest ? items.filter(e => !e.resgate) : []
        const resgates = isInvest ? items.filter(e => e.resgate) : []
        const totalAplic = aplicacoes.reduce((s, e) => s + e.amount, 0)
        const totalResg = resgates.reduce((s, e) => s + e.amount, 0)
        const total = sector === 'gasto' ? items.reduce((s, e) => s + e.amount, 0) : totalAplic - totalResg
        const icons = { gasto: '💳', investido: '📈' }
        const bankMeta = BANK_META[this.currentBank] || BANK_META.generico
        const fmt = Renderer.fmt.bind(Renderer)
        document.getElementById('detail-title').textContent = `${icons[sector]} ${SECTOR_LABELS[sector]} — ${monthName} · ${bankMeta.icon} ${bankMeta.label}`

        const renderRows = list => {
            if (!list.length) return '<div style="color:var(--text3);font-size:13px;padding:8px 0">Nenhum lançamento</div>'
            return list.map(e => `<div class="row">
        <div>
          <div class="row-name">${Renderer.esc(Renderer.aliasName(e.name))}</div>
          ${e.category ? `<div class="row-sub">${Renderer.esc(CAT_LABELS[e.category] || e.category)}</div>` : ''}
        </div>
        <div class="row-right">
          ${e.resgate ? '<span class="badge" style="background:var(--purple-bg);color:var(--purple-text)">↩ Resgate</span>' : ''}
          <span class="amount" style="color:${e.resgate ? 'var(--green)' : 'var(--text)'}">${e.resgate ? '-' : ''}${fmt(e.amount)}</span>
        </div>
      </div>`).join('')
        }

        let html = ''
        if (isInvest) {
            if (aplicacoes.length) html += `<div class="group-label" style="color:var(--purple-text)">Aplicações</div>${renderRows(aplicacoes)}<div class="subtotal"><span>Subtotal aplicado</span><span>${fmt(totalAplic)}</span></div>`
            if (resgates.length) html += `<div class="group-label" style="color:var(--green-text)">Resgates</div>${renderRows(resgates)}<div class="subtotal"><span>Subtotal resgatado</span><span style="color:var(--green)">− ${fmt(totalResg)}</span></div>`
            if (!items.length) html = '<div class="empty"><span class="empty-icon">📈</span>Nenhum lançamento de investimento este mês</div>'
        } else {
            html = renderRows(items)
            if (!items.length) html = '<div class="empty"><span class="empty-icon">💳</span>Nenhum gasto este mês</div>'
        }
        if (items.length) html += `<div class="total-row"><span>Líquido ${SECTOR_LABELS[sector].toLowerCase()}</span><span style="color:${isInvest ? 'var(--purple)' : 'var(--text)'}">${fmt(Math.max(0, total))}</span></div>`

        document.getElementById('detail-body').innerHTML = html
        document.getElementById('detail-overlay').classList.remove('hidden')
    }

    closeDetail() {
        this._bulkPending = null
        document.getElementById('detail-overlay').classList.add('hidden')
    }

    showCategoryDetail(category, bank) {
        const fmt = Renderer.fmt.bind(Renderer)
        const esc = Renderer.esc.bind(Renderer)
        const month = this.currentMonth
        const [y, mo] = month.split('-')
        const monthName = `${MONTH_NAMES[parseInt(mo) - 1]} ${y}`
        const label = CAT_LABELS[category] || category
        const color = CAT_COLORS[category] || '#888'
        const bankArg = bank || ''
        const amountRules = DataStore.getAmountRules()

        let items
        if (bank) {
            items = DataStore.getExpensesByMonth(month, bank)
                .filter(e => Classifier.sectorOf(e) === 'gasto' && (e.category || 'outros') === category)
        } else {
            const banks = DataStore.getBanksWithData().filter(b => b !== 'entre_contas')
            items = banks.flatMap(b =>
                DataStore.getExpensesByMonth(month, b)
                    .filter(e => Classifier.sectorOf(e) === 'gasto' && (e.category || 'outros') === category)
            )
        }

        const total = items.reduce((s, e) => s + e.amount, 0)
        document.getElementById('detail-title').innerHTML =
            `<span style="display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span style="width:12px;height:12px;border-radius:50%;background:${color};flex-shrink:0"></span>
              ${label} — ${monthName}
            </span>`

        const mkCatSelect = (e) => {
            const opts = Object.entries(CAT_LABELS)
                .map(([k, v]) => `<option value="${k}" ${(e.category || 'outros') === k ? 'selected' : ''}>${v}</option>`)
                .join('') + `<option value="__new__">➕ Nova categoria...</option>`
            return `<select style="margin-top:5px;font-size:11px;padding:3px 6px;border:1px solid var(--border);border-radius:4px;color:var(--text2);background:var(--surface);cursor:pointer;max-width:160px"
                onchange="app.handleCatChange('${esc(e.id)}',this,'${category}','${bankArg}')">
                ${opts}
            </select>`
        }

        // Agrupa itens por nome normalizado (destino), ordena grupo por total decrescente
        const mkGroups = (list) => {
            const groups = {}
            list.forEach(e => {
                const key = Classifier._normalizeKey(e.name)
                if (!groups[key]) groups[key] = { name: e.name, items: [] }
                groups[key].items.push(e)
            })
            return Object.values(groups).sort((a, b) => {
                const ta = a.items.reduce((s, e) => s + e.amount, 0)
                const tb = b.items.reduce((s, e) => s + e.amount, 0)
                return tb - ta
            })
        }

        // Paleta de cards coloridos — backgrounds vivos e legíveis
        const GROUP_PALETTE = [
            { bg: '#EFF6FF', border: '#93C5FD', header: '#DBEAFE', text: '#1E40AF' },
            { bg: '#F0FDF4', border: '#86EFAC', header: '#DCFCE7', text: '#166534' },
            { bg: '#FFFBEB', border: '#FCD34D', header: '#FEF3C7', text: '#92400E' },
            { bg: '#F5F3FF', border: '#C4B5FD', header: '#EDE9FE', text: '#5B21B6' },
            { bg: '#FFF1F2', border: '#FDA4AF', header: '#FFE4E6', text: '#9F1239' },
            { bg: '#F0FDFA', border: '#5EEAD4', header: '#CCFBF1', text: '#134E4A' },
            { bg: '#FFF7ED', border: '#FDBA74', header: '#FFEDD5', text: '#9A3412' },
        ]

        const pinBtn = (e) => {
            const isPinned = !!amountRules[`${Classifier._normalizeKey(e.name)}::${e.amount.toFixed(2)}`]
            const style = isPinned
                ? 'margin-top:4px;font-size:10px;padding:2px 8px;border:1.5px solid #16a34a;border-radius:4px;background:#22c55e;cursor:pointer;color:#fff;font-weight:600'
                : 'margin-top:4px;font-size:10px;padding:2px 8px;border:1px solid var(--border);border-radius:4px;background:var(--surface);cursor:pointer;color:var(--text2)'
            return `<button onclick="app.pinAmountRule('${esc(e.id)}','${category}','${bankArg}')" style="${style}" title="Fixar/desFixar categoria para este valor exato">📌 ${isPinned ? 'Fixado' : 'Fixar valor'}</button>`
        }

        const aliasBtn = (e) => {
            const currentAlias = DataStore.getAlias(Classifier._normalizeKey(e.name))
            const style = currentAlias
                ? 'margin-top:4px;margin-left:4px;font-size:10px;padding:2px 8px;border:1.5px solid #0ea5e9;border-radius:4px;background:#0ea5e9;cursor:pointer;color:#fff;font-weight:600'
                : 'margin-top:4px;margin-left:4px;font-size:10px;padding:2px 8px;border:1px solid var(--border);border-radius:4px;background:var(--surface);cursor:pointer;color:var(--text2)'
            return `<button onclick="app.editAlias('${esc(e.id)}')" style="${style}" title="Criar apelido para este destino">✏️ ${currentAlias ? esc(currentAlias) : 'Apelido'}</button>`
        }

        // Linha compacta para itens DENTRO de um card de grupo — nome já está no header
        const mkRowInCard = (e, isLast) => `<div style="display:flex;align-items:flex-start;justify-content:space-between;padding:9px 0;${isLast ? '' : 'border-bottom:1px solid rgba(0,0,0,0.07);'}">
            <div>
                <div class="row-sub" style="margin-top:0;font-size:12px">${e.dateStr || ''}</div>
                ${mkCatSelect(e)}
                ${pinBtn(e)}
            </div>
            <span class="amount" style="font-weight:600;padding-top:2px">${fmt(e.amount)}</span>
        </div>`

        // Linha completa para itens únicos (sem card)
        const mkRowSingle = (e) => `<div class="row">
            <div>
                <div class="row-name">${esc(Renderer.aliasName(e.name))}</div>
                <div class="row-sub">${e.dateStr || ''}</div>
                ${mkCatSelect(e)}
                ${pinBtn(e)}
            </div>
            <div class="row-right" style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
                <span class="amount">${fmt(e.amount)}</span>
                ${aliasBtn(e)}
            </div>
        </div>`

        const mkGroupedList = (list) => {
            const groups = mkGroups(list)
            // Índice de cor só avança para grupos com múltiplos itens
            let colorIdx = 0
            return groups.map(g => {
                const groupTotal = g.items.reduce((s, e) => s + e.amount, 0)
                if (g.items.length === 1) return mkRowSingle(g.items[0])
                const p = GROUP_PALETTE[colorIdx++ % GROUP_PALETTE.length]
                const firstId = g.items[0].id
                const groupAlias = DataStore.getAlias(Classifier._normalizeKey(g.name))
                return `<div style="border-radius:12px;border:1.5px solid ${p.border};margin-bottom:10px;overflow:hidden;background:${p.bg}">
                    <div style="background:${p.header};padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:8px">
                        <div style="min-width:0">
                            <span style="font-size:13px;font-weight:800;color:${p.text};display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(groupAlias || g.name)}</span>
                            ${groupAlias ? `<span style="font-size:10px;color:${p.text};opacity:.55;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(g.name)}</span>` : ''}
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
                            <button onclick="app.editAlias('${esc(firstId)}')" style="font-size:10px;padding:1px 6px;border:1px solid ${p.border};border-radius:4px;background:transparent;cursor:pointer;color:${p.text};opacity:.7" title="Criar apelido">✏️</button>
                            <span style="font-size:11px;font-weight:600;color:${p.text};opacity:.7;background:rgba(0,0,0,0.07);padding:2px 7px;border-radius:20px">${g.items.length} vezes</span>
                            <span style="font-size:14px;font-weight:800;color:${p.text}">${fmt(groupTotal)}</span>
                        </div>
                    </div>
                    <div style="padding:0 14px">
                        ${g.items.map((e, i) => mkRowInCard(e, i === g.items.length - 1)).join('')}
                    </div>
                </div>`
            }).join('')
        }

        let html = ''
        if (!items.length) {
            html = `<div class="empty"><span class="empty-icon">📂</span>Nenhum gasto nesta categoria este mês.</div>`
        } else if (bank) {
            html = mkGroupedList(items)
            html += `<div class="total-row"><span>Total em ${label}</span><span>${fmt(total)}</span></div>`
        } else {
            const byBank = {}
            items.forEach(e => { const b = e.bank || 'generico'; (byBank[b] = byBank[b] || []).push(e) })
            for (const [b, list] of Object.entries(byBank)) {
                const meta = BANK_META[b] || BANK_META.generico
                const subtotal = list.reduce((s, e) => s + e.amount, 0)
                html += `<div class="group-label" style="color:${meta.color}">${meta.icon} ${meta.label}</div>`
                html += mkGroupedList(list)
                html += `<div class="subtotal"><span>Subtotal ${meta.label}</span><span>${fmt(subtotal)}</span></div>`
            }
            html += `<div class="total-row"><span>Total em ${label}</span><span>${fmt(total)}</span></div>`
        }

        this._catDetailState = { category, bank, bankArg, items, label, color, month }
        const searchWrap = document.getElementById('detail-search-wrap')
        const searchEl = document.getElementById('detail-search')
        if (items.length > 5) {
            searchWrap.style.display = 'block'
            searchEl.value = ''
        } else {
            searchWrap.style.display = 'none'
        }
        document.getElementById('detail-body').innerHTML = html
        document.getElementById('detail-overlay').classList.remove('hidden')
    }

    filterCategoryDetail(query) {
        const s = this._catDetailState
        if (!s) return
        const q = query.trim().toLowerCase()
        const filtered = q ? s.items.filter(e => e.name.toLowerCase().includes(q)) : s.items
        const fmt = Renderer.fmt.bind(Renderer)
        const total = filtered.reduce((acc, e) => acc + e.amount, 0)

        const mkGroups = (list) => {
            const groups = {}
            list.forEach(e => {
                const key = Classifier._normalizeKey(e.name)
                if (!groups[key]) groups[key] = { name: e.name, items: [] }
                groups[key].items.push(e)
            })
            return Object.values(groups).sort((a, b) =>
                b.items.reduce((s, e) => s + e.amount, 0) - a.items.reduce((s, e) => s + e.amount, 0)
            )
        }
        const esc = Renderer.esc.bind(Renderer)
        const amountRules = DataStore.getAmountRules()
        const cat = s.category
        const bankArg = s.bankArg

        const mkCatSelect = (e) => {
            const opts = Object.entries(CAT_LABELS)
                .map(([k, v]) => `<option value="${k}" ${(e.category || 'outros') === k ? 'selected' : ''}>${v}</option>`)
                .join('') + `<option value="__new__">➕ Nova categoria...</option>`
            return `<select style="margin-top:5px;font-size:11px;padding:3px 6px;border:1px solid var(--border);border-radius:4px;color:var(--text2);background:var(--surface);cursor:pointer;max-width:160px"
                onchange="app.handleCatChange('${esc(e.id)}',this,'${cat}','${bankArg}')">
                ${opts}
            </select>`
        }
        const pinBtn = (e) => {
            const isPinned = !!amountRules[`${Classifier._normalizeKey(e.name)}::${e.amount.toFixed(2)}`]
            const style = isPinned
                ? 'margin-top:4px;font-size:10px;padding:2px 8px;border:1.5px solid #16a34a;border-radius:4px;background:#22c55e;cursor:pointer;color:#fff;font-weight:600'
                : 'margin-top:4px;font-size:10px;padding:2px 8px;border:1px solid var(--border);border-radius:4px;background:var(--surface);cursor:pointer;color:var(--text2)'
            return `<button onclick="app.pinAmountRule('${esc(e.id)}','${cat}','${bankArg}')" style="${style}">📌 ${isPinned ? 'Fixado' : 'Fixar valor'}</button>`
        }
        const mkAliasBtnFilter = (e) => {
            const a = DataStore.getAlias(Classifier._normalizeKey(e.name))
            const style = a
                ? 'font-size:10px;padding:1px 8px;border:1.5px solid #0ea5e9;border-radius:4px;background:#0ea5e9;cursor:pointer;color:#fff;font-weight:600'
                : 'font-size:10px;padding:1px 8px;border:1px solid var(--border);border-radius:4px;background:var(--surface);cursor:pointer;color:var(--text2)'
            return `<button onclick="app.editAlias('${esc(e.id)}')" style="${style}">✏️ ${a ? esc(a) : 'Apelido'}</button>`
        }
        const mkRowSingle = (e) => `<div class="row"><div>
            <div class="row-name">${esc(Renderer.aliasName(e.name))}</div>
            <div class="row-sub">${e.dateStr || ''}</div>
            ${mkCatSelect(e)}${pinBtn(e)}
            </div><div class="row-right" style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
            <span class="amount">${fmt(e.amount)}</span>
            ${mkAliasBtnFilter(e)}
            </div></div>`
        const GROUP_PALETTE = [
            { bg: '#EFF6FF', border: '#93C5FD', header: '#DBEAFE', text: '#1E40AF' },
            { bg: '#F0FDF4', border: '#86EFAC', header: '#DCFCE7', text: '#166534' },
            { bg: '#FFFBEB', border: '#FCD34D', header: '#FEF3C7', text: '#92400E' },
            { bg: '#F5F3FF', border: '#C4B5FD', header: '#EDE9FE', text: '#5B21B6' },
            { bg: '#FFF1F2', border: '#FDA4AF', header: '#FFE4E6', text: '#9F1239' },
        ]
        const mkGroupedList = (list) => {
            let ci = 0
            return mkGroups(list).map(g => {
                const gt = g.items.reduce((s, e) => s + e.amount, 0)
                if (g.items.length === 1) return mkRowSingle(g.items[0])
                const p = GROUP_PALETTE[ci++ % GROUP_PALETTE.length]
                const groupAlias = DataStore.getAlias(Classifier._normalizeKey(g.name))
                return `<div style="border-radius:12px;border:1.5px solid ${p.border};margin-bottom:10px;overflow:hidden;background:${p.bg}">
                    <div style="background:${p.header};padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:8px">
                        <div style="min-width:0">
                            <span style="font-size:13px;font-weight:800;color:${p.text};display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(groupAlias || g.name)}</span>
                            ${groupAlias ? `<span style="font-size:10px;color:${p.text};opacity:.55;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(g.name)}</span>` : ''}
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
                            <button onclick="app.editAlias('${esc(g.items[0].id)}')" style="font-size:10px;padding:1px 6px;border:1px solid ${p.border};border-radius:4px;background:transparent;cursor:pointer;color:${p.text};opacity:.7" title="Criar apelido">✏️</button>
                            <span style="font-size:14px;font-weight:800;color:${p.text}">${fmt(gt)}</span>
                        </div>
                    </div>
                    <div style="padding:0 14px">${g.items.map((e, i) => `<div style="display:flex;align-items:flex-start;justify-content:space-between;padding:9px 0;${i < g.items.length-1 ? 'border-bottom:1px solid rgba(0,0,0,0.07)' : ''}">
                        <div><div style="font-size:12px;color:var(--text3)">${e.dateStr||''}</div>${mkCatSelect(e)}${pinBtn(e)}</div>
                        <span class="amount" style="font-weight:600;padding-top:2px">${fmt(e.amount)}</span>
                    </div>`).join('')}</div>
                </div>`
            }).join('')
        }

        let html = filtered.length === 0
            ? `<div class="empty"><span class="empty-icon">🔍</span>Nenhum gasto encontrado para "${esc(query)}".</div>`
            : (() => {
                if (s.bank) {
                    return mkGroupedList(filtered) + `<div class="total-row"><span>Total encontrado</span><span>${fmt(total)}</span></div>`
                }
                const byBank = {}
                filtered.forEach(e => { const b = e.bank || 'generico'; (byBank[b] = byBank[b] || []).push(e) })
                return Object.entries(byBank).map(([b, list]) => {
                    const meta = BANK_META[b] || BANK_META.generico
                    const st = list.reduce((acc, e) => acc + e.amount, 0)
                    return `<div class="group-label" style="color:${meta.color}">${meta.icon} ${meta.label}</div>` +
                        mkGroupedList(list) +
                        `<div class="subtotal"><span>Subtotal ${meta.label}</span><span>${fmt(st)}</span></div>`
                }).join('') + `<div class="total-row"><span>Total encontrado</span><span>${fmt(total)}</span></div>`
            })()

        document.getElementById('detail-body').innerHTML = html
    }

    async editAlias(id) {
        const expense = DataStore.getExpenseById(id)
        if (!expense) return
        const key = Classifier._normalizeKey(expense.name)
        const current = DataStore.getAlias(key) || ''
        const alias = await this._showAliasModal(expense.name, current)
        if (alias === null) return
        if (alias.trim()) {
            await DataStore.setAlias(key, alias.trim())
        } else {
            await DataStore.removeAlias(key)
        }
        if (this._catDetailState) {
            this.showCategoryDetail(this._catDetailState.category, this._catDetailState.bank || null)
        }
        this.render()
    }

    _showAliasModal(rawName, currentAlias) {
        return new Promise(resolve => {
            const overlay = document.createElement('div')
            overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(2px)'

            const box = document.createElement('div')
            box.style.cssText = 'background:var(--surface);border-radius:16px;padding:24px;width:100%;max-width:360px;box-shadow:0 20px 60px rgba(0,0,0,0.25)'

            const removeRow = currentAlias
                ? `<button id="_alias_remove" style="width:100%;margin-bottom:8px;padding:9px;border:1.5px solid #fca5a5;border-radius:8px;background:transparent;color:#ef4444;font-size:13px;cursor:pointer;font-weight:600">Remover apelido</button>`
                : ''

            box.innerHTML = `
                <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:6px">✏️ Criar apelido</div>
                <div style="font-size:11px;color:var(--text3);margin-bottom:20px;padding:8px 10px;background:var(--bg);border-radius:8px;word-break:break-all">${Renderer.esc(rawName)}</div>
                <label style="font-size:12px;font-weight:600;color:var(--text2);display:block;margin-bottom:6px">Apelido</label>
                <input id="_alias_input" type="text" placeholder="Ex: Barraquinha Faculdade" value="${Renderer.esc(currentAlias)}"
                    style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;color:var(--text);background:var(--surface);outline:none;margin-bottom:16px;transition:border-color .15s">
                ${removeRow}
                <div style="display:flex;gap:8px">
                    <button id="_alias_cancel" style="flex:1;padding:10px;border:1.5px solid var(--border);border-radius:8px;background:transparent;color:var(--text2);font-size:14px;cursor:pointer;font-weight:500">Cancelar</button>
                    <button id="_alias_save" style="flex:1;padding:10px;border:none;border-radius:8px;background:#0ea5e9;color:#fff;font-size:14px;font-weight:600;cursor:pointer">Salvar</button>
                </div>
            `

            overlay.appendChild(box)
            document.body.appendChild(overlay)

            const input = box.querySelector('#_alias_input')
            input.focus()
            input.select()
            input.addEventListener('focus', () => { input.style.borderColor = '#0ea5e9' })
            input.addEventListener('blur', () => { input.style.borderColor = '' })

            const close = (val) => { document.body.removeChild(overlay); resolve(val) }

            overlay.addEventListener('click', e => { if (e.target === overlay) close(null) })
            box.querySelector('#_alias_cancel').addEventListener('click', () => close(null))
            box.querySelector('#_alias_save').addEventListener('click', () => close(input.value))
            if (currentAlias) box.querySelector('#_alias_remove').addEventListener('click', () => close(''))
            input.addEventListener('keydown', e => {
                if (e.key === 'Enter') close(input.value)
                if (e.key === 'Escape') close(null)
            })
        })
    }

    async changeExpenseCategory(id, newCat, currentCat, bank) {
        const expense = DataStore.getExpenseById(id)
        if (!expense) { this.showCategoryDetail(currentCat, bank || null); return }

        const memoLower = expense.name.toLowerCase()
        const others = DataStore.load().expenses.filter(e =>
            String(e.id) !== String(id) &&
            e.name.toLowerCase() === memoLower &&
            e.category !== newCat
        )

        await Promise.all([
            DataStore.updateExpenseCategory(id, newCat),
            DataStore.setRule(memoLower, newCat),
        ])

        if (others.length > 0) {
            this._bulkPending = { memoLower, newCat, currentCat, bank: bank || null }

            const fmt = Renderer.fmt.bind(Renderer)
            const esc = Renderer.esc.bind(Renderer)
            const catLabel = CAT_LABELS[newCat] || newCat
            const catColor = CAT_COLORS[newCat] || '#888'
            const s = others.length > 1 ? 's' : ''
            const total = others.reduce((acc, e) => acc + e.amount, 0)

            const preview = others.slice(0, 3)
            const more = others.length - preview.length
            const previewHtml = `<div style="background:var(--surface);border-radius:8px;padding:.6rem .9rem;margin-bottom:1rem;text-align:left">
                ${preview.map((e, i) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;${i < preview.length - 1 || more > 0 ? 'border-bottom:1px solid var(--border)' : ''}">
                    <span style="font-size:12px;color:var(--text3)">${esc(e.dateStr || e.month)}</span>
                    <span style="font-size:13px;font-weight:600">${fmt(e.amount)}</span>
                </div>`).join('')}
                ${more > 0 ? `<div style="font-size:12px;color:var(--text3);padding-top:6px;text-align:center">e mais ${more} lançamento${more > 1 ? 's' : ''}...</div>` : ''}
            </div>`

            document.getElementById('detail-title').innerHTML = `🏷️ Alterar categoria em lote?`
            document.getElementById('detail-body').innerHTML = `
                <div style="text-align:center;padding:.5rem 0 1rem">
                    <div style="width:52px;height:52px;border-radius:50%;background:${catColor}22;display:flex;align-items:center;justify-content:center;font-size:26px;margin:0 auto .75rem">🏷️</div>
                    <div style="font-size:15px;font-weight:800;color:var(--text);margin-bottom:.4rem">
                        ${others.length} outro${s} gasto${s} igual encontrado${s}
                    </div>
                    <div style="font-size:13px;color:var(--text2);margin-bottom:.6rem;line-height:1.5">
                        Nome: <span style="font-family:monospace;background:var(--surface2);border-radius:6px;padding:2px 8px;font-size:12px">${esc(expense.name)}</span>
                    </div>
                    <div style="font-size:12px;color:var(--text3);margin-bottom:1rem">Total nos outros lançamentos: <strong style="color:var(--text2)">${fmt(total)}</strong></div>
                    ${previewHtml}
                    <div style="font-size:13px;color:var(--text2);margin-bottom:1.25rem">
                        Deseja mover todos para <span style="color:${catColor};font-weight:700">${esc(catLabel)}</span>?
                    </div>
                    <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
                        <button onclick="app._confirmBulkCat(true)"
                            style="padding:10px 22px;border-radius:8px;border:none;background:${catColor};color:#fff;font-size:13px;font-weight:700;cursor:pointer;transition:opacity .15s"
                            onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
                            ✓ Aplicar a todos
                        </button>
                        <button onclick="app._confirmBulkCat(false)"
                            style="padding:10px 22px;border-radius:8px;border:1.5px solid var(--border);background:transparent;color:var(--text2);font-size:13px;font-weight:600;cursor:pointer">
                            Só este gasto
                        </button>
                    </div>
                </div>`
            document.getElementById('detail-overlay').classList.remove('hidden')
            return
        }

        this.showCategoryDetail(currentCat, bank || null)
        this.render()
        setTimeout(() => this._renderOverviewChart(), 50)
    }

    async _confirmBulkCat(applyAll) {
        const p = this._bulkPending
        if (!p) return
        this._bulkPending = null

        if (applyAll) {
            await DataStore.bulkUpdateExpenseCategories(p.memoLower, p.newCat)
            this._showToast(`✓ Categoria atualizada em todos os lançamentos iguais`, 'toast-success')
        }

        this.showCategoryDetail(p.currentCat, p.bank)
        this.render()
        setTimeout(() => this._renderOverviewChart(), 50)
    }

    editCategoryName(category, bankArg) {
        const current = CAT_LABELS[category] || category
        const emojiRe = /^([\p{Emoji_Presentation}\p{Extended_Pictographic}])\s*/u
        const currentEmoji = emojiRe.exec(current)?.[1] || this._emojiForName(current)
        const currentName = current.replace(emojiRe, '').trim()

        this._catRenameState = { category, bankArg, selectedEmoji: currentEmoji }

        const EMOJIS = [
            // Moradia & Casa
            '🏠','🏡','🛋️','🔑','🪴','🚿','🛁','🪟','🧹','🧺',
            // Alimentação
            '🍽️','🍕','🍔','🌮','🍜','🍣','🥗','🥩','🥦','🍰','☕','🍺','🍷','🧃','🫖',
            // Transporte
            '🚗','⛽','🚌','🚇','🛵','🚲','✈️','🚢','🅿️','🛴',
            // Saúde
            '💊','🏥','🩺','🩹','🧘','💉','🦷','👁️',
            // Educação
            '📚','🎓','✏️','🖊️','📐','🖥️','💻',
            // Lazer & Entretenimento
            '🎮','🎬','🎵','🎨','🎭','⚽','🏀','🎾','🏊','🚴','🏋️','🎳','🎯','🏖️',
            // Compras & Moda
            '🛒','👗','👠','👜','💍','🕶️','🎒','💄',
            // Finanças
            '💳','💰','💸','🏦','📈','🪙','💵',
            // Pets
            '🐾','🐶','🐱','🐠','🐦','🐇',
            // Família & Pessoas
            '👶','👨‍👩‍👧','💅','🎁','🌹',
            // Trabalho
            '💼','📊','📋','📱','🔧','🔑','🖨️',
            // Viagem
            '🧳','🗺️','🏕️','🗼','🏰',
            // Natureza
            '🌿','🌻','🌴','🍀','🌾','☀️','🌧️',
            // Outros
            '📦','🎀','⭐','🔔','🏷️',
        ]

        const esc = Renderer.esc.bind(Renderer)
        const mkBtn = e => `<button class="emoji-pick-btn${e === currentEmoji ? ' selected' : ''}" onclick="app._selectRenameEmoji('${e}')" data-emoji="${e}">${e}</button>`
        const visible = EMOJIS.slice(0, 32).map(mkBtn).join('')
        const hidden = EMOJIS.slice(32).map(mkBtn).join('')
        const grid = `${visible}<div id="emoji-extra" style="display:none;contents">${hidden}
            <button class="emoji-more-btn" onclick="document.getElementById('emoji-extra').style.display='none';document.getElementById('emoji-more-btn').style.display='inline-flex'">− ver menos</button>
            </div><button id="emoji-more-btn" class="emoji-more-btn" onclick="document.getElementById('emoji-extra').style.display='contents';this.style.display='none'">+ ver mais</button>`

        document.getElementById('detail-title').innerHTML = `Renomear categoria`
        document.getElementById('detail-search-wrap').style.display = 'none'
        document.getElementById('detail-body').innerHTML = `
            <div style="margin-bottom:1rem">
                <div style="font-size:12px;color:var(--text3);margin-bottom:6px;font-weight:500">NOME</div>
                <input id="cat-rename-input" class="inp" type="text" value="${esc(currentName)}"
                    oninput="app._updateRenamePreview()"
                    onfocus="this.select()"
                    style="width:100%;box-sizing:border-box;font-size:15px"
                    placeholder="Nome da categoria">
            </div>
            <div style="margin-bottom:1rem">
                <div style="font-size:12px;color:var(--text3);margin-bottom:8px;font-weight:500">ÍCONE</div>
                <div class="emoji-grid">${grid}</div>
            </div>
            <div id="cat-rename-preview" class="cat-rename-preview">${currentEmoji} ${esc(currentName)}</div>
            <div style="margin-top:1.25rem">
                <button class="add-btn" style="width:100%" onclick="app._saveCategoryRename()">Salvar</button>
            </div>`

        document.getElementById('detail-overlay').classList.remove('hidden')
        setTimeout(() => document.getElementById('cat-rename-input')?.focus(), 80)
    }

    _selectRenameEmoji(emoji) {
        if (!this._catRenameState) return
        this._catRenameState.selectedEmoji = emoji
        document.querySelectorAll('.emoji-pick-btn').forEach(b => b.classList.toggle('selected', b.dataset.emoji === emoji))
        this._updateRenamePreview()
    }

    _updateRenamePreview() {
        const name = document.getElementById('cat-rename-input')?.value.trim() || ''
        const emoji = this._catRenameState?.selectedEmoji || '📦'
        const el = document.getElementById('cat-rename-preview')
        if (el) el.textContent = `${emoji} ${name}`
    }

    async _saveCategoryRename() {
        const s = this._catRenameState
        if (!s) return
        const rawName = document.getElementById('cat-rename-input')?.value.trim()
        if (!rawName) return
        const cleanName = rawName.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]\s*/u, '').trim()
        const final = `${s.selectedEmoji} ${cleanName}`
        await DataStore.renameCategory(s.category, final)
        this._catRenameState = null
        this._syncCustomCategories()
        this.render()
        setTimeout(() => this._renderOverviewChart(), 50)
        this.closeDetail()
    }

    async handleCatChange(id, el, currentCat, bankArg) {
        if (el.value === '__new__') {
            const newKey = await this._createCustomCategory()
            if (newKey) {
                await this.changeExpenseCategory(id, newKey, newKey, bankArg || null)
            } else {
                const exp = DataStore.getExpenseById(id)
                el.value = exp?.category || 'outros'
            }
        } else {
            await this.changeExpenseCategory(id, el.value, currentCat, bankArg || null)
        }
    }

    async pinAmountRule(id, currentCat, bankArg) {
        const expense = DataStore.getExpenseById(id)
        if (!expense) return
        const normKey = Classifier._normalizeKey(expense.name)
        const key = `${normKey}::${expense.amount.toFixed(2)}`
        const wasPinned = !!(DataStore.getAmountRules() || {})[key]
        if (wasPinned) {
            await DataStore.removeAmountRule(normKey, expense.amount)
            this._showToast('📌 Regra de valor removida', 'toast-info')
        } else {
            await DataStore.setAmountRule(normKey, expense.amount, expense.category || currentCat)
            const catLabel = CAT_LABELS[expense.category || currentCat] || currentCat
            this._showToast(`📌 Fixado! ${Renderer.fmt(expense.amount)} → ${catLabel}`, 'toast-success')
        }
        this.showCategoryDetail(currentCat, bankArg || null)
    }

    _showToast(msg, type = 'toast-success') {
        let el = document.getElementById('app-toast')
        if (!el) {
            el = document.createElement('div')
            el.id = 'app-toast'
            el.className = 'toast'
            document.body.appendChild(el)
        }
        el.textContent = msg
        el.className = `toast ${type}`
        clearTimeout(this._toastTimer)
        void el.offsetWidth // força reflow para reiniciar transição
        el.classList.add('show')
        this._toastTimer = setTimeout(() => el.classList.remove('show'), 2500)
    }

    async handleImportCatChange(idx, el) {
        if (el.value === '__new__') {
            const newKey = await this._createCustomCategory()
            if (newKey) {
                this.importPending[idx].category = newKey
                this._renderImportModal()
            } else {
                el.value = this.importPending[idx].category || 'outros'
            }
        } else {
            this.importPending[idx].category = el.value
        }
    }

    // ── Importação de extratos ──────────────────────────────────────────────────
    onDragOver(e) { e.preventDefault(); e.stopPropagation(); document.getElementById('dropzone').classList.add('drag-over') }
    onDragLeave(e) { e.preventDefault(); document.getElementById('dropzone').classList.remove('drag-over') }

    onDrop(e) {
        e.preventDefault(); e.stopPropagation()
        document.getElementById('dropzone').classList.remove('drag-over')
        const file = e.dataTransfer.files[0]
        if (!file) return
        const ext = file.name.split('.').pop().toLowerCase()
        if (!['ofx', 'pdf', 'csv'].includes(ext)) { alert('Formato não suportado. Use .CSV, .OFX ou .PDF.'); return }
        this._readFile(file)
    }

    handleFileInput(event) {
        const file = event.target.files[0]
        if (file) this._readFile(file)
        event.target.value = ''
    }

    _readFile(file) {
        const session = AuthService.getSession()
        const userName = this.currentUser?.name || session?.name || null

        const ext = file.name.split('.').pop().toLowerCase()
        if (ext === 'pdf') {
            const dz = document.getElementById('dropzone')
            const origHTML = dz.innerHTML
            const restoreDropzone = () => { dz.innerHTML = origHTML }

            this.importer.setUser(userName) // define ANTES do parsePDF para detecção interna
            this.importer.parsePDF(file, loading => {
                if (!loading) { dz.innerHTML = origHTML; return }
                const title = typeof loading === 'string' ? loading : 'Lendo PDF...'
                const sub = typeof loading === 'string' ? '' : '<div class="drop-sub">Aguarde um momento</div>'
                dz.innerHTML = `<span class="drop-icon" style="opacity:.6">⏳</span><div class="drop-title">${title}</div>${sub}`
            }).then(async () => {
                if (!this.importer.transactions.length) {
                    if (this.importer.saldoFinal !== null && this.importer.saldoMonth) {
                        await DataStore.setBalance(this.importer.saldoMonth, this.importer.bank, this.importer.saldoFinal)
                        restoreDropzone()
                        this.currentBank = 'geral'
                        this.render()
                        alert(`✓ Saldo de ${Renderer.fmt(this.importer.saldoFinal)} salvo com sucesso.`)
                    } else {
                        alert('Nenhuma transação encontrada no PDF.')
                        restoreDropzone()
                    }
                    return
                }
                this._openImportModal()
            }).catch(err => {
                restoreDropzone()
                alert('Erro ao ler o PDF: ' + err.message)
            })
        } else {
            const reader = new FileReader()
            reader.onload = e => {
                try {
                    this.importer.reset()
                    this.importer.setUser(userName) // define APÓS reset, não antes
                    if (ext === 'csv') this.importer.parseCSV(e.target.result)
                    else this.importer.parseOFX(e.target.result)
                    if (!this.importer.transactions.length) { alert(`Nenhuma transação encontrada no arquivo ${ext.toUpperCase()}.`); return }
                    this._openImportModal()
                } catch (err) { alert('Erro ao ler o arquivo: ' + err.message) }
            }
            reader.readAsText(file, 'UTF-8')
        }
    }

    _openImportModal() {
        this.importPending = this.importer.transactions.map((t, idx) => ({ ...t, idx }))
        this._renderImportModal()
        document.getElementById('modal-overlay').classList.remove('hidden')
    }

    closeModal() {
        document.getElementById('modal-overlay').classList.add('hidden')
        this.importPending = []
        this.importer.reset()
    }

    _renderImportModal() {
        const fmt = Renderer.fmt.bind(Renderer)
        const pending = this.importPending
        const selected = pending.filter(t => t.selected).length
        document.getElementById('modal-footer-info').textContent = `${selected} de ${pending.length} transações selecionadas`

        const bankLabel = { nubank: 'Nubank', inter: 'Inter', caixa: 'Caixa', generico: 'Banco desconhecido' }
        const bankIcon = { nubank: '🟣', inter: '🟠', caixa: '🔵', generico: '🏦' }
        const bank = this.importer.bank || 'generico'
        const userName = this.importer.userName
        const debugInfo = userName
            ? `🔍 Detectando transferências internas para: <strong>${Renderer.esc(userName)}</strong>`
            : `⚠ Nome do usuário não identificado — transferências internas não serão detectadas. Faça logout e login novamente.`

        let html = `<div class="step-info">
      ${bankIcon[bank]} Banco identificado: <strong>${bankLabel[bank]}</strong> — usando regras específicas para este banco.
      <br>${debugInfo}
      <br>Transações encontradas: <strong>${pending.length}</strong>. <strong>Desmarque</strong> as que não quer importar e ajuste o <strong>setor</strong> se necessário.
    </div>`

        // DEBUG: mostra linhas extraídas do PDF quando banco é Caixa ou não detectado
        if ((bank === 'caixa' || bank === 'generico') && this.importer._debugLines) {
            html += `<div style="background:#fff8e1;border:1px solid #f59e0b;border-radius:var(--rs);padding:10px 12px;margin-bottom:1rem;font-size:11px;font-family:monospace;white-space:pre;overflow:auto;max-height:200px;color:#92400e">📋 Banco: ${bank} | Linhas extraídas (debug):\n${Renderer.esc(this.importer._debugLines)}</div>`
        }

        if (this.importer.saldoFinal !== null) {
            const [y, mo] = (this.importer.saldoMonth || '').split('-')
            const mLabel = mo ? `${MONTH_NAMES[parseInt(mo) - 1]} ${y}` : ''
            html += `<div style="background:var(--green-bg);color:var(--green-text);border-radius:var(--rs);padding:10px 14px;font-size:13px;margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between;gap:12px">
        <span>🏦 <strong>Saldo final detectado:</strong> ${fmt(this.importer.saldoFinal)} ${mLabel ? `<span style="opacity:.7">· ${mLabel}</span>` : ''}</span>
        <span style="opacity:.7;font-size:12px">Será salvo como "Em conta"</span>
      </div>`
        }

        html += `<div class="sel-all-row"><input type="checkbox" id="chk-all" checked onchange="app.toggleAllImport(this.checked)"><label for="chk-all">Selecionar / desmarcar tudo</label></div>`

        const byMonth = {}
        pending.forEach(t => { if (!byMonth[t.month]) byMonth[t.month] = []; byMonth[t.month].push(t) })

        for (const [month, txs] of Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0]))) {
            const [y, mo] = month.split('-')
            html += `<div style="font-size:12px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;padding:10px 0 6px;border-top:1px solid var(--border)">${MONTH_NAMES[parseInt(mo) - 1]} ${y}</div>`
            html += `<table class="import-table"><thead><tr><th style="width:32px"></th><th>Descrição</th><th>Data</th><th>Valor</th><th>Setor</th><th>Tipo</th><th>Categoria</th></tr></thead><tbody>`
            txs.forEach(t => {
                const sectorOpts = ['gasto', 'investido', 'em_conta'].map(s => `<option value="${s}" ${(t.sector || 'gasto') === s ? 'selected' : ''}>${SECTOR_LABELS[s]}</option>`).join('')
                const catOpts = Object.entries(CAT_LABELS).map(([k, v]) => `<option value="${k}" ${(t.category || 'outros') === k ? 'selected' : ''}>${v}</option>`).join('') + `<option value="__new__">➕ Nova categoria...</option>`
                const showCat = !t.isIncome && !t.resgate && !t.internal && (t.sector || 'gasto') === 'gasto'
                html += `<tr id="row-${t.idx}" class="${t.selected ? '' : 'skip'}">
          <td><input type="checkbox" ${t.selected ? 'checked' : ''} onchange="app.toggleImportRow(${t.idx},this.checked)"></td>
          <td><div class="imp-desc">${Renderer.esc(t.memo)}</div></td>
          <td class="imp-date">${t.dateStr}</td>
          <td class="imp-amount ${t.isIncome ? 'imp-income' : 'imp-expense'}">${t.isIncome ? '+' : '-'} ${fmt(t.amount)}</td>
          <td>${t.isIncome ? '<span style="color:var(--text3);font-size:12px">Renda</span>' :
                        t.resgate ? '<span style="background:var(--purple-bg);color:var(--purple-text);font-size:11px;padding:2px 8px;border-radius:20px;font-weight:500">↩ Resgate investido</span>' :
                            t.internal ? '<span style="background:var(--green-bg);color:var(--green-text);font-size:11px;padding:2px 8px;border-radius:20px;font-weight:500">🔁 Entre contas</span>' :
                                `<select onchange="app.setImportSector(${t.idx},this.value)">${sectorOpts}</select>`}</td>
          <td>${t.isIncome || t.sector === 'investido' || t.sector === 'em_conta' ? '' :
                        `<select onchange="app.setImportType(${t.idx},this.value)">
  <option value="variavel" ${t.expType === 'variavel' ? 'selected' : ''}>Variável</option>
  <option value="fixo" ${t.expType === 'fixo' ? 'selected' : ''}>Fixo</option>
</select>`}</td>
          <td>${showCat ? `<select onchange="app.handleImportCatChange(${t.idx},this)">${catOpts}</select>` : ''}</td>
        </tr>`
            })
            html += `</tbody></table>`
        }

        document.getElementById('modal-body').innerHTML = html
    }

    toggleImportRow(idx, checked) {
        this.importPending[idx].selected = checked
        document.getElementById('row-' + idx).className = checked ? '' : 'skip'
        const sel = this.importPending.filter(t => t.selected).length
        document.getElementById('modal-footer-info').textContent = `${sel} de ${this.importPending.length} transações selecionadas`
    }

    toggleAllImport(checked) {
        this.importPending.forEach((_, i) => {
            this.importPending[i].selected = checked
            const row = document.getElementById('row-' + i)
            if (row) row.className = checked ? '' : 'skip'
        })
        const sel = this.importPending.filter(t => t.selected).length
        document.getElementById('modal-footer-info').textContent = `${sel} de ${this.importPending.length} transações selecionadas`
    }

    setImportSector(idx, val) { this.importPending[idx].sector = val; this._renderImportModal() }
    setImportType(idx, val) { this.importPending[idx].expType = val }
    setImportCategory(idx, val) { this.importPending[idx].category = val }


    openEntreContasModal() {
        const fmt = Renderer.fmt.bind(Renderer)
        const esc = Renderer.esc.bind(Renderer)
        const data = DataStore.load()
        const month = this.currentMonth
        // Pega todas as saídas 'entre_contas' do mês em todos os bancos
        const items = data.expenses.filter(e => e.month === month && e.sector === 'entre_contas')
        const total = items.reduce((s, e) => s + e.amount, 0)
        const [y, mo] = month.split('-')
        const monthName = `${MONTH_NAMES[parseInt(mo) - 1]} ${y}`

        // Render into the existing detail modal
        document.getElementById('detail-title').textContent = `🔁 Entre contas — ${monthName}`
        let html = ``

        if (!items.length) {
            html += `<div class="empty"><span class="empty-icon">🔁</span>
        Nenhuma movimentação interna encontrada este mês.<br>
        <span style="font-size:12px">Transferências enviadas para você mesmo aparecerão aqui.</span>
      </div>`
        } else {
            html += `<div class="card">`
            // Agrupa por banco de origem
            const byBank = {}
            items.forEach(e => {
                const b = e.bank || 'generico'
                if (!byBank[b]) byBank[b] = []
                byBank[b].push(e)
            })

            for (const [bank, list] of Object.entries(byBank)) {
                const meta = BANK_META[bank] || BANK_META.generico
                const subtotal = list.reduce((s, e) => s + e.amount, 0)
                html += `<div class="group-label" style="color:${meta.color}">${meta.icon} Saiu do ${meta.label}</div>`
                list.forEach(e => {
                    html += `<div class="row">
<div>
  <div class="row-name">${esc(e.name)}</div>
</div>
<div class="row-right">
  <span class="badge" style="background:var(--green-bg);color:var(--green-text)">🔁 Interno</span>
  <span class="amount">${fmt(e.amount)}</span>
</div>
          </div>`
                })
                html += `<div class="subtotal"><span>Subtotal ${meta.label}</span><span>${fmt(subtotal)}</span></div>`
            }

            html += `<div class="total-row"><span>Total movimentado entre contas</span><span>${fmt(total)}</span></div>`

            html += `<div class="alert" style="background:var(--green-bg);color:var(--green-text);margin-top:1rem">
        ✓ Estes valores <strong>não contam como gasto</strong> em nenhum banco — são apenas transferências entre suas próprias contas.
      </div>`
            html += `</div>`
        }

        document.getElementById('detail-body').innerHTML = html
        document.getElementById('detail-overlay').classList.remove('hidden')
    }

    async confirmImport() {
        const toImport = this.importPending.filter(t => t.selected)
        if (!toImport.length) { alert('Nenhuma transação selecionada.'); return }

        await DataStore.importBatch(
            toImport,
            this.importer.bank,
            this.importer.saldoFinal,
            this.importer.saldoMonth,
        )

        this.closeModal()

        const months = toImport.map(t => t.month).sort().reverse()
        if (months.length) this.currentMonth = months[0]
        this.currentBank = 'geral'

        this.render()
        alert(`✓ ${toImport.length} transações importadas com sucesso!`)
    }
}

window.FinanceApp = FinanceApp
