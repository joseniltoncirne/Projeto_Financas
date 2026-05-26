// ─────────────────────────────────────────────────────────────────────────────
// CategoryDetailUI — modal de detalhe de categoria/setor
// ─────────────────────────────────────────────────────────────────────────────

Object.assign(FinanceApp.prototype, {

    // Fabrica helpers compartilhados entre showCategoryDetail e filterCategoryDetail,
    // eliminando a duplicação de mkGroups / mkGroupedList / mkRowSingle / mkRowInCard.
    _mkCategoryDetailHelpers(category, bankArg) {
        const fmt = Renderer.fmt.bind(Renderer)
        const esc = Renderer.esc.bind(Renderer)
        const amountRules = DataStore.getAmountRules()

        const GROUP_PALETTE = [
            { bg: '#EFF6FF', border: '#93C5FD', header: '#DBEAFE', text: '#1E40AF' },
            { bg: '#F0FDF4', border: '#86EFAC', header: '#DCFCE7', text: '#166534' },
            { bg: '#FFFBEB', border: '#FCD34D', header: '#FEF3C7', text: '#92400E' },
            { bg: '#F5F3FF', border: '#C4B5FD', header: '#EDE9FE', text: '#5B21B6' },
            { bg: '#FFF1F2', border: '#FDA4AF', header: '#FFE4E6', text: '#9F1239' },
            { bg: '#F0FDFA', border: '#5EEAD4', header: '#CCFBF1', text: '#134E4A' },
            { bg: '#FFF7ED', border: '#FDBA74', header: '#FFEDD5', text: '#9A3412' },
        ]

        const mkGroups = (list) => {
            const groups = {}
            list.forEach(e => {
                const key = Classifier._normalizeKey(e.name)
                if (!groups[key]) groups[key] = { name: e.name, items: [] }
                groups[key].items.push(e)
            })
            const toISO = d => d ? d.split('/').reverse().join('-') : ''
            const latestDate = g => g.items.reduce((best, e) => {
                const d = toISO(e.dateStr)
                return d > best ? d : best
            }, '')
            return Object.values(groups).sort((a, b) =>
                latestDate(b).localeCompare(latestDate(a))
            )
        }

        const mkCatSelect = (e) => {
            const custom = DataStore.getCustomCategories()
            let opts
            if (e.type === 'fixo') {
                opts = Object.entries(custom)
                    .filter(([, c]) => c.isFixed)
                    .map(([k, c]) => `<option value="${k}" ${(e.category || '') === k ? 'selected' : ''}>${c.label}</option>`)
                    .join('')
            } else {
                opts = Object.entries(CAT_LABELS)
                    .map(([k, v]) => `<option value="${k}" ${(e.category || 'outros') === k ? 'selected' : ''}>${v}</option>`)
                    .join('') + `<option value="__new__">➕ Nova categoria...</option>`
            }
            return `<select style="margin-top:5px;font-size:11px;padding:3px 6px;border:1px solid var(--border);border-radius:4px;color:var(--text2);background:var(--surface);cursor:pointer;max-width:160px"
                onchange="app.handleCatChange('${esc(e.id)}',this,'${category}','${bankArg}')">
                ${opts}
            </select>`
        }

        const pinBtn = (e) => {
            const isPinned = !!amountRules[`${Classifier._normalizeKey(e.name)}::${e.amount.toFixed(2)}`]
            const style = isPinned
                ? 'margin-top:4px;font-size:10px;padding:2px 8px;border:1.5px solid #16a34a;border-radius:4px;background:#22c55e;cursor:pointer;color:#fff;font-weight:600'
                : 'margin-top:4px;font-size:10px;padding:2px 8px;border:1px solid var(--border);border-radius:4px;background:var(--surface);cursor:pointer;color:var(--text2)'
            return `<button onclick="app.pinAmountRule('${esc(e.id)}','${category}','${bankArg}')" style="${style}" title="Fixar/desfixar categoria para este valor exato">📌 ${isPinned ? 'Fixado' : 'Fixar valor'}</button>`
        }

        const aliasBtn = (e) => {
            const currentAlias = DataStore.getAlias(Classifier._normalizeKey(e.name))
            const style = currentAlias
                ? 'margin-top:4px;margin-left:4px;font-size:10px;padding:2px 8px;border:1.5px solid #0ea5e9;border-radius:4px;background:#0ea5e9;cursor:pointer;color:#fff;font-weight:600'
                : 'margin-top:4px;margin-left:4px;font-size:10px;padding:2px 8px;border:1px solid var(--border);border-radius:4px;background:var(--surface);cursor:pointer;color:var(--text2)'
            return `<button onclick="app.editAlias('${esc(e.id)}')" style="${style}" title="Criar apelido para este destino">✏️ ${currentAlias ? esc(currentAlias) : 'Apelido'}</button>`
        }

        const mkRowInCard = (e, isLast) => `<div style="display:flex;align-items:flex-start;justify-content:space-between;padding:9px 0;${isLast ? '' : 'border-bottom:1px solid rgba(0,0,0,0.07);'}">
            <div>
                <div class="row-sub" style="margin-top:0;font-size:12px">${e.dateStr || ''}</div>
                ${mkCatSelect(e)}
                ${pinBtn(e)}
            </div>
            <span class="amount" style="font-weight:600;padding-top:2px">${fmt(e.amount)}</span>
        </div>`

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

        const sortByDateDesc = items => [...items].sort((a, b) => {
            if (!a.dateStr && !b.dateStr) return 0
            if (!a.dateStr) return 1
            if (!b.dateStr) return -1
            const toISO = d => d.split('/').reverse().join('-')
            return toISO(b.dateStr).localeCompare(toISO(a.dateStr))
        })

        const mkGroupedList = (list) => {
            let colorIdx = 0
            return mkGroups(list).map(g => {
                const groupTotal = g.items.reduce((s, e) => s + e.amount, 0)
                if (g.items.length === 1) return mkRowSingle(g.items[0])
                const p = GROUP_PALETTE[colorIdx++ % GROUP_PALETTE.length]
                const sorted = sortByDateDesc(g.items)
                const firstId = sorted[0].id
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
                        ${sorted.map((e, i) => mkRowInCard(e, i === sorted.length - 1)).join('')}
                    </div>
                </div>`
            }).join('')
        }

        return { fmt, esc, mkGroups, mkCatSelect, pinBtn, aliasBtn, mkRowInCard, mkRowSingle, mkGroupedList }
    },

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

        const toISO = d => d.split('/').reverse().join('-')
        const sortByDate = list => [...list].sort((a, b) => {
            if (!a.dateStr && !b.dateStr) return 0
            if (!a.dateStr) return 1
            if (!b.dateStr) return -1
            return toISO(b.dateStr).localeCompare(toISO(a.dateStr))
        })
        const renderRows = list => {
            if (!list.length) return '<div style="color:var(--text3);font-size:13px;padding:8px 0">Nenhum lançamento</div>'
            return sortByDate(list).map(e => {
                const datePart = e.dateStr ? e.dateStr.slice(0, 5) : ''
                const catLabel = e.category ? (CAT_LABELS[e.category] || e.category) : ''
                const subText = [datePart, catLabel].filter(Boolean).join(' · ')
                return `<div class="row">
        <div>
          <div class="row-name">${Renderer.esc(Renderer.aliasName(e.name))}</div>
          ${subText ? `<div class="row-sub">${Renderer.esc(subText)}</div>` : ''}
        </div>
        <div class="row-right">
          ${e.resgate ? '<span class="badge" style="background:var(--purple-bg);color:var(--purple-text)">↩ Resgate</span>' : ''}
          <span class="amount" style="color:${e.resgate ? 'var(--green)' : 'var(--text)'}">${e.resgate ? '-' : ''}${fmt(e.amount)}</span>
        </div>
      </div>`
            }).join('')
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
    },

    closeDetail() {
        this._bulkPending = null
        document.getElementById('detail-overlay').classList.add('hidden')
    },

    _catDetailHelpHtml() {
        return `<details class="cat-detail-help">
            <summary>
                <span>💡 O que cada botão faz?</span>
                <span class="cat-help-chevron">▾</span>
            </summary>
            <div class="cat-help-body">
                <div class="cat-help-item">
                    <div class="cat-help-icon">📌</div>
                    <div>
                        <div class="cat-help-title">Fixar valor</div>
                        <div class="cat-help-desc">Toda transação com o mesmo nome <strong>e</strong> mesmo valor exato será classificada automaticamente nessa categoria. Útil pra cobranças recorrentes idênticas.</div>
                    </div>
                </div>
                <div class="cat-help-item">
                    <div class="cat-help-icon">✏️</div>
                    <div>
                        <div class="cat-help-title">Apelido</div>
                        <div class="cat-help-desc">Mostra um nome amigável no lugar da descrição original do banco. Ex: "Transferência enviada · João Silva" pode virar "Aluguel". Não afeta a classificação.</div>
                    </div>
                </div>
            </div>
        </details>`
    },

    showCategoryDetail(category, bank) {
        const fmt = Renderer.fmt.bind(Renderer)
        const month = this.currentMonth
        const [y, mo] = month.split('-')
        const monthName = `${MONTH_NAMES[parseInt(mo) - 1]} ${y}`
        const label = CAT_LABELS[category] || category
        const color = CAT_COLORS[category] || '#888'
        const bankArg = bank || ''

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

        const { mkGroupedList } = this._mkCategoryDetailHelpers(category, bankArg)

        let html = ''
        if (!items.length) {
            html = `<div class="empty"><span class="empty-icon">📂</span>Nenhum gasto nesta categoria este mês.</div>`
        } else {
            html = this._catDetailHelpHtml()
            if (bank) {
                html += mkGroupedList(items)
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
    },

    filterCategoryDetail(query) {
        const s = this._catDetailState
        if (!s) return
        const q = query.trim().toLowerCase()
        const filtered = q ? s.items.filter(e =>
            e.name.toLowerCase().includes(q) ||
            (Renderer.aliasName(e.name) !== e.name && Renderer.aliasName(e.name).toLowerCase().includes(q))
        ) : s.items
        const fmt = Renderer.fmt.bind(Renderer)
        const esc = Renderer.esc.bind(Renderer)
        const total = filtered.reduce((acc, e) => acc + e.amount, 0)

        const { mkGroupedList } = this._mkCategoryDetailHelpers(s.category, s.bankArg)

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
    },
})
