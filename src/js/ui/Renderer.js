// ═══════════════════════════════════════════════════════════════════════════════
class Renderer {
    static fmt(n) {
        return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    }

    // Retorna o apelido do destino se existir, senão retorna o nome original
    static aliasName(rawName) {
        const key = Classifier._normalizeKey(rawName)
        return DataStore.getAlias(key) || rawName
    }

    static monthLabel(m) {
        const [y, mo] = m.split('-')
        return `${MONTH_NAMES[parseInt(mo) - 1]} ${y}`
    }

    static renderBankNav(banks, currentBank) {
        const nav = document.getElementById('bank-nav')
        if (!banks.length) {
            nav.innerHTML = ''
            return
        }
        const geralActive = currentBank === 'geral'
        nav.innerHTML = `<button class="bank-tab geral ${geralActive ? 'active' : ''}" style="display:inline-flex;align-items:center;gap:5px;${geralActive
            ? 'background:#1C1C2E;color:#fff;border-color:#1C1C2E'
            : 'color:#1C1C2E;border-color:#1C1C2E'}" onclick="app.switchBank('geral')">📊 Geral</button>`
            + banks.filter(b => b !== 'entre_contas').map(b => {
            const meta = BANK_META[b] || BANK_META.generico
            const isActive = b === currentBank
            const style = isActive
                ? `background:${meta.color};color:#fff;border-color:${meta.color}`
                : `color:${meta.color};border-color:${meta.color}`
            return `<button class="bank-tab ${b} ${isActive ? 'active' : ''}" style="display:inline-flex;align-items:center;gap:5px;${style}" onclick="app.switchBank('${b}')">${meta.logo} ${meta.label}</button>`
        }).join('')
            + `<button class="entre-contas-tab" onclick="app.switchBank('entre_contas')">🔁 Entre contas</button>`
    }

    static _summaryForBank(month, bank) {
        const incomes = DataStore.getIncomesByMonth(month, bank)
        const expenses = DataStore.getExpensesByMonth(month, bank)
        const renda = incomes.reduce((s, i) => s + i.amount, 0)
        const gasto = expenses
            .filter(e => Classifier.sectorOf(e) === 'gasto' && e.sector !== 'entre_contas')
            .reduce((s, e) => s + e.amount, 0)
        const aplicado = expenses
            .filter(e => Classifier.sectorOf(e) === 'investido' && !e.resgate)
            .reduce((s, e) => s + e.amount, 0)
        const resgatado = expenses
            .filter(e => Classifier.sectorOf(e) === 'investido' && e.resgate)
            .reduce((s, e) => s + e.amount, 0)
        const investido = Math.max(0, aplicado - resgatado)
        const balance = DataStore.getBalance(month, bank)

        return {
            bank,
            renda,
            gasto,
            investido,
            emConta: balance === undefined ? 0 : balance,
            hasBalance: balance !== undefined,
            sobra: renda - gasto - investido,
            movimento: renda + gasto + Math.max(0, investido),
        }
    }

    static renderOverview(month, banks, currentBank) {
        const el = document.getElementById('sec-overview')
        if (!el) return
        if (!banks.length || (currentBank && currentBank !== 'geral')) {
            el.innerHTML = ''
            return
        }

        const rows = banks.filter(b => b !== 'entre_contas').map(bank => this._summaryForBank(month, bank))
        const total = rows.reduce((acc, item) => ({
            renda: acc.renda + item.renda,
            gasto: acc.gasto + item.gasto,
            investido: acc.investido + item.investido,
            emConta: acc.emConta + item.emConta,
            hasBalance: acc.hasBalance || item.hasBalance,
            sobra: acc.sobra + item.sobra,
        }), { renda: 0, gasto: 0, investido: 0, emConta: 0, hasBalance: false, sobra: 0 })
        const hasAnyMovement = rows.some(r => r.renda || r.gasto || r.investido || r.hasBalance)

        const gastoRows = [...rows].sort((a, b) => b.gasto - a.gasto)
        const investRows = [...rows].sort((a, b) => b.investido - a.investido)
        const emContaRows = rows.filter(r => r.hasBalance).sort((a, b) => b.emConta - a.emConta)

        const mkDonutSection = ({ id, items, valueKey, title, accentColor, bgColor, borderColor, emptyMsg }) => {
            const sectionTotal = items.reduce((s, r) => s + r[valueKey], 0)
            const legend = items.map(r => {
                const meta = BANK_META[r.bank] || BANK_META.generico
                const pct = sectionTotal > 0 ? Math.round(r[valueKey] / sectionTotal * 100) : 0
                return `<div style="margin-bottom:10px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                  <span style="display:flex;align-items:center;gap:5px">
                    <span style="width:9px;height:9px;border-radius:50%;background:${meta.color};flex-shrink:0"></span>
                    <span style="font-size:12px;color:var(--text2)">${meta.icon} ${meta.label}</span>
                  </span>
                  <span style="font-size:12px;font-weight:600">${this.fmt(r[valueKey])} <span style="font-size:10px;color:var(--text3);font-weight:400">${pct}%</span></span>
                </div>
                <div style="height:3px;border-radius:2px;background:rgba(0,0,0,0.07)">
                  <div style="height:100%;width:${pct}%;background:${meta.color};border-radius:2px"></div>
                </div>
              </div>`
            }).join('')
            const hasAnyValue = items.some(r => r[valueKey] > 0)
            const inner = hasAnyValue
                ? `<div style="display:flex;gap:1.25rem;align-items:center;flex-wrap:wrap">
                <div style="width:130px;height:130px;flex-shrink:0">
                  <canvas id="${id}"></canvas>
                </div>
                <div style="flex:1;min-width:140px">${legend}</div>
              </div>`
                : `<div style="font-size:12px;color:var(--text3);padding:1rem 0;text-align:center">${emptyMsg}</div>`
            return `<div style="flex:1;min-width:240px;background:${bgColor};border-radius:var(--r);padding:1rem 1.1rem;border-top:3px solid ${borderColor}">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${accentColor};margin-bottom:4px">${title}</div>
            <div style="font-size:22px;font-weight:700;color:var(--text);margin-bottom:14px;line-height:1">${hasAnyValue ? this.fmt(sectionTotal) : '—'}</div>
            ${inner}
          </div>`
        }

        el.innerHTML = `<div class="overview-card is-active">
      <div class="overview-header">
        <div>
          <div class="overview-kicker">Resumo geral</div>
          <div class="overview-title">${this.monthLabel(month)}</div>
        </div>
        <div class="overview-month-nav">
          <button class="month-btn" onclick="app.shiftMonth(-1)">‹</button>
          <button class="month-btn" onclick="app.shiftMonth(1)">›</button>
        </div>
      </div>
      ${hasAnyMovement ? `
      ${total.hasBalance ? `<div style="display:flex;align-items:center;flex-wrap:wrap;gap:.75rem;padding:.55rem 1rem;background:var(--amber-bg);border-left:3px solid var(--amber);border-radius:var(--rs);margin-bottom:.75rem">
        <span style="font-size:11px;font-weight:700;color:var(--amber-text);white-space:nowrap">🏦 Em conta</span>
        <span style="font-size:15px;font-weight:700;color:var(--amber-text)">${this.fmt(total.emConta)}</span>
        ${emContaRows.length > 1 ? `<span style="margin-left:auto;display:flex;gap:.6rem;flex-wrap:wrap">` + emContaRows.map(r => { const m = BANK_META[r.bank] || BANK_META.generico; return `<span style="font-size:11px;color:var(--amber-text);white-space:nowrap">${m.icon} ${m.label}: <strong>${this.fmt(r.emConta)}</strong></span>` }).join('') + `</span>` : ''}
      </div>` : ''}
      <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:.75rem">
        ${mkDonutSection({ id: 'overviewDonutGasto',  items: gastoRows,  valueKey: 'gasto',     title: '💳 Gasto total',     accentColor: 'var(--red-text)',    bgColor: 'var(--red-bg)',    borderColor: 'var(--red)',    emptyMsg: 'Nenhum gasto registrado' })}
        ${mkDonutSection({ id: 'overviewDonutInvest', items: investRows, valueKey: 'investido', title: '📈 Investido total', accentColor: 'var(--purple-text)', bgColor: 'var(--purple-bg)', borderColor: 'var(--purple)', emptyMsg: 'Nenhum investimento registrado' })}
      </div>
      ${(() => {
          const allGastos = banks.filter(b => b !== 'entre_contas').flatMap(b =>
              DataStore.getExpensesByMonth(month, b).filter(e => Classifier.sectorOf(e) === 'gasto')
          )
          const catTotals = {}
          allGastos.forEach(e => { catTotals[e.category || 'outros'] = (catTotals[e.category || 'outros'] || 0) + e.amount })
          const catList = Object.entries(catTotals).sort((a, b) => b[1] - a[1])
          if (!catList.length) return ''
          const catRows = catList.map(([cat, val]) => {
              const pct = total.gasto > 0 ? Math.round(val / total.gasto * 100) : 0
              const color = CAT_COLORS[cat] || '#888'
              return `<div style="margin-bottom:10px;cursor:pointer;border-radius:6px;padding:4px 6px;margin-left:-6px;margin-right:-6px;transition:background .15s" onclick="app.showCategoryDetail('${cat}')" onmouseover="this.style.background='rgba(0,0,0,0.04)'" onmouseout="this.style.background='transparent'">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                  <span style="display:flex;align-items:center;gap:6px">
                    <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></span>
                    <span style="font-size:12px;color:var(--text2)">${CAT_LABELS[cat] || cat}</span>
                    <button class="cat-rename-btn" onclick="event.stopPropagation();app.editCategoryName('${cat}','')" title="Renomear categoria"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>
                  </span>
                  <span style="display:flex;align-items:center;gap:6px">
                    <span style="font-size:12px;font-weight:600">${this.fmt(val)} <span style="font-size:10px;color:var(--text3);font-weight:400">${pct}%</span></span>
                    <span style="font-size:11px;color:var(--text3)">▸</span>
                  </span>
                </div>
                <div style="height:3px;border-radius:2px;background:rgba(0,0,0,0.07)">
                  <div style="height:100%;width:${pct}%;background:${color};border-radius:2px"></div>
                </div>
              </div>`
          }).join('')
          return `<div style="background:var(--surface2);border-radius:var(--r);padding:1rem 1.1rem;margin-bottom:.75rem">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-bottom:8px">📊 Gastos por categoria <span style="font-size:10px;font-weight:400;text-transform:none;letter-spacing:0">· clique para ver detalhes</span></div>
            ${catRows}
          </div>`
      })()}
      ` : `<div class="empty" style="padding:1.25rem 1rem"><span class="empty-icon">📊</span>Nenhum dado consolidado para ${this.monthLabel(month)}.</div>`}
    </div>`
    }

    // Escapa caracteres HTML para evitar XSS em dados do usuário
    static esc(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
    }

    static renderSummary(month, bank) {
        const incomes = DataStore.getIncomesByMonth(month, bank)
        const expenses = DataStore.getExpensesByMonth(month, bank)
        const totalInc = incomes.reduce((s, i) => s + i.amount, 0)
        const totalGasto = expenses.filter(e => Classifier.sectorOf(e) === 'gasto' && e.sector !== 'entre_contas').reduce((s, e) => s + e.amount, 0)
        const totalAplic = expenses.filter(e => Classifier.sectorOf(e) === 'investido' && !e.resgate).reduce((s, e) => s + e.amount, 0)
        const totalResg = expenses.filter(e => Classifier.sectorOf(e) === 'investido' && e.resgate).reduce((s, e) => s + e.amount, 0)
        const totalInvest = Math.max(0, totalAplic - totalResg)
        const isEmpty = totalInc === 0 && expenses.length === 0
        const pctGasto = totalInc > 0 ? Math.min(100, Math.round(totalGasto / totalInc * 100)) : 0
        const pctInvest = totalInc > 0 ? Math.min(100, Math.round(totalInvest / totalInc * 100)) : 0
        const balance = DataStore.getBalance(month, bank)
        const hasBalance = balance !== undefined

        let html = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:1rem">
      <div class="metric-card" style="border-top:3px solid var(--red);cursor:pointer" onclick="app.showSectorDetail('gasto')" title="Ver detalhes">
        <div class="metric-label" style="color:var(--red-text)">💳 Gasto <span style="font-size:10px;opacity:.5">▸</span></div>
        <div class="metric-value" style="font-size:18px">${this.fmt(totalGasto)}</div>
      </div>
      <div class="metric-card" style="border-top:3px solid var(--purple);cursor:pointer" onclick="app.showSectorDetail('investido')" title="Ver detalhes">
        <div class="metric-label" style="color:var(--purple-text)">📈 Investido <span style="font-size:10px;opacity:.5">▸</span></div>
        <div class="metric-value" style="font-size:18px">${this.fmt(totalInvest)}</div>
      </div>
      <div class="metric-card" style="border-top:3px solid var(--green);cursor:pointer" onclick="app.editBalance('${month}', '${bank}')" title="Clique para editar">
        <div class="metric-label" style="color:var(--green-text)">🏦 Em conta <span style="font-size:10px;opacity:.6">✎</span></div>
        <div class="metric-value" style="font-size:18px;color:${hasBalance ? 'var(--green)' : 'var(--text3)'}">
          ${hasBalance ? this.fmt(balance) : '—'}
        </div>
        ${!hasBalance ? `<div style="font-size:10px;color:var(--text3);margin-top:2px">Importe o extrato</div>` : ''}
      </div>
    </div>`

        if (!isEmpty) {
            let alert = ''
            if (pctGasto > 90) alert = `<div class="alert" style="background:var(--red-bg);color:var(--red-text)">⚠ Atenção: seus gastos estão acima da sua renda.</div>`
            else if (pctGasto > 70) alert = `<div class="alert" style="background:var(--amber-bg);color:var(--amber-text)">○ Mais de 70% da renda foi para gastos. Fique de olho.</div>`
            else if (pctGasto > 0 && pctInvest > 0) alert = `<div class="alert" style="background:var(--green-bg);color:var(--green-text)">✓ Você gastou ${pctGasto}% e investiu ${pctInvest}% da renda.</div>`
            else if (pctGasto > 0) alert = `<div class="alert" style="background:var(--green-bg);color:var(--green-text)">✓ Boa situação este mês!</div>`

            html += `<div class="card">
        <div class="prog-header">
          <span class="prog-label">Uso da renda</span>
          <span style="font-size:13px;color:var(--text2)">${pctGasto}% gasto · ${pctInvest}% investido</span>
        </div>
        <div class="prog-track" style="height:12px;border-radius:6px;overflow:hidden;display:flex">
          <div style="height:100%;background:var(--red);width:${pctGasto}%;transition:width .4s"></div>
          <div style="height:100%;background:var(--purple);width:${pctInvest}%;transition:width .4s"></div>
        </div>
        <div class="prog-sub">
          <span style="color:var(--red-text)">■ Gasto: ${this.fmt(totalGasto)}</span>
          <span style="color:var(--purple-text)">■ Investido: ${this.fmt(totalInvest)}</span>
          <span>Renda: ${this.fmt(totalInc)}</span>
        </div>
        ${alert}
      </div>`
        }

        if (isEmpty) {
            html += `<div class="card"><div class="empty"><span class="empty-icon">◈</span>Nenhum dado para este mês.<br>Adicione sua renda e seus gastos nas abas acima.</div></div>`
        }

        // Gastos por categoria
        const cats = {}
        expenses.filter(e => Classifier.sectorOf(e) === 'gasto').forEach(e => { cats[e.category] = (cats[e.category] || 0) + e.amount })
        const catList = Object.entries(cats).sort((a, b) => b[1] - a[1])
        if (catList.length > 0) {
            html += `<div class="card"><div class="card-title" style="margin-bottom:.75rem">Gastos por categoria <span style="font-size:11px;color:var(--text3);font-weight:400">· clique para ver detalhes</span></div>`
            catList.forEach(([cat, val]) => {
                const p = totalGasto > 0 ? Math.round(val / totalGasto * 100) : 0
                const color = CAT_COLORS[cat] || '#888'
                html += `<div class="cat-row" style="cursor:pointer" onclick="app.showCategoryDetail('${cat}','${bank}')">
          <div class="cat-dot" style="background:${color}"></div>
          <span class="cat-name">${CAT_LABELS[cat] || cat}</span>
          <button class="cat-rename-btn" onclick="event.stopPropagation();app.editCategoryName('${cat}','${bank||''}')" title="Renomear categoria"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>
          <div class="cat-bar-wrap"><div class="cat-bar-fill" style="width:${p}%;background:${color}"></div></div>
          <span class="cat-val">${this.fmt(val)}</span>
          <span class="cat-pct">${p}%</span>
          <span style="font-size:11px;color:var(--text3);margin-left:4px">▸</span>
        </div>`
            })
            html += `</div>`
        }

        document.getElementById('sec-resumo').innerHTML = html
    }

    static renderIncomes(month, bank, showForm) {
        const items = DataStore.getIncomesByMonth(month, bank)
        const total = items.reduce((s, i) => s + i.amount, 0)

        const formHtml = showForm ? `<div class="form-row">
      <input class="inp" id="inc-name" placeholder="Ex: Salário, Freelance...">
      <input class="inp" id="inc-amount" type="number" min="0.01" step="0.01" placeholder="Valor (R$)" style="max-width:150px">
      <button class="save-btn" onclick="app.addIncome()">Salvar</button>
    </div>` : ''

        let rowsHtml = items.length === 0 && !showForm
            ? `<div class="empty"><span class="empty-icon">↑</span>Nenhuma renda cadastrada para este mês</div>`
            : items.map(i => `<div class="row">
          <div><div class="row-name">${this.esc(this.aliasName(i.name))}</div></div>
          <div class="row-right">
<span class="amount" style="color:var(--green)">${this.fmt(i.amount)}</span>
<button class="del-btn" onclick="app.removeIncome('${this.esc(i.id)}')">×</button>
          </div>
        </div>`).join('')

        if (items.length > 0) rowsHtml += `<div class="total-row"><span>Total de rendas</span><span style="color:var(--green)">${this.fmt(total)}</span></div>`

        document.getElementById('sec-rendas').innerHTML = `<div class="card">
      <div class="card-header">
        <span class="card-title">Fontes de renda</span>
        <div style="display:flex;gap:6px">
          ${items.length > 0 ? `<button class="add-btn" style="color:var(--red-text);border-color:rgba(212,88,40,.25)" onclick="app.clearIncomes()">Limpar</button>` : ''}
          <button class="add-btn" onclick="app.toggleIncForm()">${showForm ? '× Cancelar' : '+ Adicionar'}</button>
        </div>
      </div>
      ${formHtml}${rowsHtml}
    </div>`
    }

    static renderExpenses(month, bank, showForm) {
        const all = DataStore.getExpensesByMonth(month, bank)
        const gastos = all.filter(e => Classifier.sectorOf(e) === 'gasto')
        const investidos = all.filter(e => Classifier.sectorOf(e) === 'investido')
        const emConta = all.filter(e => Classifier.sectorOf(e) === 'em_conta')

        const formHtml = showForm ? `<div class="form-row">
      <input class="inp" id="exp-name" placeholder="Descrição..." style="min-width:120px">
      <input class="inp" id="exp-amount" type="number" min="0.01" step="0.01" placeholder="Valor (R$)" style="max-width:135px">
      <select class="sel" id="exp-sector">
        <option value="gasto">💳 Gasto</option>
        <option value="investido">📈 Investido</option>
        <option value="em_conta">🔄 Em conta</option>
      </select>
      <select class="sel" id="exp-type">
        <option value="variavel">Variável</option>
        <option value="fixo">Fixo</option>
      </select>
      <select class="sel" id="exp-cat">
        ${Object.entries(CAT_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
      </select>
      <button class="save-btn" onclick="app.addExpense()">Salvar</button>
    </div>` : ''

        const renderGroup = (list, sectorKey) => {
            if (!list.length) return ''
            const sc = SECTOR_COLORS[sectorKey]
            const sub = list.reduce((s, e) => s + e.amount, 0)
            const icon = sectorKey === 'gasto' ? '💳' : sectorKey === 'investido' ? '📈' : '🔄'
            let h = `<div class="group-label" style="color:${sc.text}">${icon} ${SECTOR_LABELS[sectorKey]}</div>`
            list.forEach(e => {
                const isFixo = e.type === 'fixo'
                h += `<div class="row">
          <div>
<div class="row-name">${this.esc(this.aliasName(e.name))}</div>
<div class="row-sub">${this.esc(CAT_LABELS[e.category] || e.category || '')}</div>
          </div>
          <div class="row-right">
${sectorKey === 'gasto' ? `<span class="badge" style="background:${isFixo ? 'var(--blue-bg)' : 'var(--amber-bg)'};color:${isFixo ? 'var(--blue-text)' : 'var(--amber-text)'}">${isFixo ? 'Fixo' : 'Variável'}</span>` : ''}
<span class="badge" style="background:${sc.bg};color:${sc.text}">${e.resgate ? '↩ Resgate' : SECTOR_LABELS[sectorKey]}</span>
<span class="amount">${this.fmt(e.amount)}</span>
<button class="del-btn" onclick="app.removeExpense('${this.esc(e.id)}')">×</button>
          </div>
        </div>`
            })
            h += `<div class="subtotal"><span>Subtotal ${SECTOR_LABELS[sectorKey].toLowerCase()}</span><span>${this.fmt(sub)}</span></div>`
            return h
        }

        let body = !all.length
            ? `<div class="empty"><span class="empty-icon">↓</span>Nenhuma movimentação cadastrada para este mês</div>`
            : renderGroup(gastos, 'gasto') + renderGroup(investidos, 'investido') + renderGroup(emConta, 'em_conta')

        const saidas = all.filter(e => e.sector !== 'entre_contas')
        if (saidas.length) {
            body += `<div class="total-row"><span>Total saídas</span><span>${this.fmt(saidas.reduce((s, e) => s + e.amount, 0))}</span></div>`
        }

        document.getElementById('sec-gastos').innerHTML = `<div class="card">
      <div class="card-header">
        <span class="card-title">Movimentações</span>
        <div style="display:flex;gap:6px">
          ${all.length > 0 ? `<button class="add-btn" style="color:var(--red-text);border-color:rgba(212,88,40,.25)" onclick="app.clearExpenses()">Limpar</button>` : ''}
          <button class="add-btn" onclick="app.toggleExpForm()">${showForm ? '× Cancelar' : '+ Adicionar'}</button>
        </div>
      </div>
      ${formHtml}${body}
    </div>`
    }

    static renderAnalysis(month, bank) {
        const data = DataStore.load()
        const months = DataStore.getRecentMonths()
        const inc = DataStore.getIncomesByMonth(month, bank).reduce((s, i) => s + i.amount, 0)
        const expenses = DataStore.getExpensesByMonth(month, bank)
        const gasto = expenses.filter(e => Classifier.sectorOf(e) === 'gasto').reduce((s, e) => s + e.amount, 0)
        const invest = Math.max(0, expenses.filter(e => Classifier.sectorOf(e) === 'investido' && !e.resgate).reduce((s, e) => s + e.amount, 0)
            - expenses.filter(e => Classifier.sectorOf(e) === 'investido' && e.resgate).reduce((s, e) => s + e.amount, 0))
        const hasData = months.some(m => data.incomes.some(i => i.month === m && i.bank === bank) || data.expenses.some(e => e.month === m && e.bank === bank))

        if (!hasData) {
            document.getElementById('sec-analise').innerHTML = `<div class="card"><div class="empty"><span class="empty-icon">⌁</span>Cadastre rendas e gastos para ver a análise.</div></div>`
            return
        }

        const cats = {}
        expenses.filter(e => Classifier.sectorOf(e) === 'gasto').forEach(e => { cats[e.category] = (cats[e.category] || 0) + e.amount })
        const pieData = Object.entries(cats).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])

        let pieHtml = ''
        if (pieData.length > 0) {
            const legend = pieData.map(([cat, val], i) => `<div class="cat-row" style="margin-bottom:8px">
        <div class="cat-dot" style="background:${PIE_COLORS[i % 7]}"></div>
        <span class="cat-name">${CAT_LABELS[cat] || cat}</span>
        <span class="cat-val">${this.fmt(val)}</span>
        <span class="cat-pct">${gasto > 0 ? Math.round(val / gasto * 100) : 0}%</span>
      </div>`).join('')
            pieHtml = `<div class="card">
        <div class="card-title" style="margin-bottom:.75rem">Distribuição de gastos — mês atual</div>
        <div style="display:flex;gap:1.5rem;flex-wrap:wrap;align-items:center">
          <div style="position:relative;width:180px;height:180px;flex-shrink:0"><canvas id="pieChart"></canvas></div>
          <div style="flex:1;min-width:160px">${legend}</div>
        </div>
      </div>`
        }

        document.getElementById('sec-analise').innerHTML = `
      <div class="card">
        <div class="card-title" style="margin-bottom:.5rem">Histórico — últimos 6 meses</div>
        <div class="legend">
          <span><span class="leg-dot" style="background:#1a9e74"></span>Renda</span>
          <span><span class="leg-dot" style="background:#d45828"></span>Gasto</span>
          <span><span class="leg-dot" style="background:#6040c8"></span>Investido</span>
        </div>
        <div class="chart-wrap"><canvas id="barChart"></canvas></div>
      </div>
      ${pieHtml}
      <div class="card">
        <div class="card-title" style="margin-bottom:.4rem">Regra 50/30/20</div>
        <p class="rule-desc">Referência: 50% da renda para necessidades, 30% para desejos, 20% para poupança.</p>
        ${this._ruleBar('Gastos (necessidades + desejos)', gasto, inc, 80, '#d45828')}
        ${this._ruleBar('Investido / poupança', invest, inc, 20, '#6040c8')}
      </div>`
    }

    static _ruleBar(label, actual, income, target, color) {
        const pct = income > 0 ? Math.min(100, Math.round(actual / income * 100)) : 0
        const ok = pct <= target
        return `<div class="rule-row">
      <div class="rule-meta">
        <span>${label}</span>
        <span>
          <span style="color:${ok ? 'var(--green)' : 'var(--red)'};font-weight:600">${pct}%</span>
          <span style="color:var(--text3)"> / meta ${target}%</span>
          <span style="color:var(--text2);margin-left:8px">${this.fmt(actual)}</span>
        </span>
      </div>
      <div class="rule-track">
        <div class="rule-target" style="width:${target}%"></div>
        <div class="rule-fill" style="width:${pct}%;background:${ok ? color : 'var(--red)'}"></div>
      </div>
    </div>`
    }

    static renderCharts(month, bank, barChart, pieChart) {
        const data = DataStore.load()
        const months = DataStore.getRecentMonths()
        const labels = months.map(m => { const [, mo] = m.split('-'); return MONTH_SHORT[parseInt(mo) - 1] })

        const incData = months.map(m => Math.round(data.incomes.filter(i => i.month === m && i.bank === bank).reduce((s, i) => s + i.amount, 0) * 100) / 100)
        const gastoData = months.map(m => Math.round(data.expenses.filter(e => e.month === m && e.bank === bank && Classifier.sectorOf(e) === 'gasto').reduce((s, e) => s + e.amount, 0) * 100) / 100)
        const investData = months.map(m => Math.round(data.expenses.filter(e => e.month === m && e.bank === bank && Classifier.sectorOf(e) === 'investido').reduce((s, e) => s + e.amount, 0) * 100) / 100)

        const barEl = document.getElementById('barChart')
        if (barEl) {
            if (barChart) barChart.destroy()
            barChart = new Chart(barEl, {
                type: 'bar',
                data: {
                    labels, datasets: [
                        { label: 'Renda', data: incData, backgroundColor: '#C9A84C', borderRadius: 4, maxBarThickness: 28 },
                        { label: 'Gasto', data: gastoData, backgroundColor: '#d45828', borderRadius: 4, maxBarThickness: 28 },
                        { label: 'Investido', data: investData, backgroundColor: '#6040c8', borderRadius: 4, maxBarThickness: 28 },
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: '#888', font: { size: 12 } } },
                        y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#888', font: { size: 11 }, callback: v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v }, border: { display: false } }
                    }
                }
            })
        }

        const cats = {}
        DataStore.getExpensesByMonth(month, bank).forEach(e => { cats[e.category] = (cats[e.category] || 0) + e.amount })
        const pieEntries = Object.entries(cats).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
        const pieEl = document.getElementById('pieChart')
        if (pieEl && pieEntries.length > 0) {
            if (pieChart) pieChart.destroy()
            pieChart = new Chart(pieEl, {
                type: 'doughnut',
                data: {
                    labels: pieEntries.map(([c]) => CAT_LABELS[c] || c),
                    datasets: [{ data: pieEntries.map(([, v]) => Math.round(v * 100) / 100), backgroundColor: PIE_COLORS.slice(0, pieEntries.length), borderWidth: 0 }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            })
        }

        return { barChart, pieChart }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLASS: FinanceApp — controlador principal, orquestra tudo

window.Renderer = Renderer
