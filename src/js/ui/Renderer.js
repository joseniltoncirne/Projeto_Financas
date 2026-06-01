// ═══════════════════════════════════════════════════════════════════════════════
class Renderer {
    static fmt(n) {
        return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    }

    static _catLabel(cat) {
        if (!cat) return ''
        const custom = DataStore.getCustomCategories()
        return CAT_LABELS[cat] || custom[cat]?.label || cat
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
        const tabs = `<button class="bank-tab geral${geralActive ? ' active' : ''}" onclick="app.switchBank('geral')">📊 Geral</button>`
            + banks.filter(b => b !== 'entre_contas').map(b => {
                const meta = BANK_META[b] || BANK_META.generico
                const isActive = b === currentBank
                // Cores expostas como CSS vars para o estado ativo
                const styleVars = `--bank-color:${meta.color};--bank-bg:${meta.bg};--bank-text:${meta.textColor || meta.color}`
                return `<button class="bank-tab ${b}${isActive ? ' active' : ''}" style="${styleVars}" onclick="app.switchBank('${b}')">${meta.logo} ${meta.label}</button>`
            }).join('')
        const entreContas = `<button class="entre-contas-tab" title="Movimentações entre contas" onclick="app.switchBank('entre_contas')">🔁</button>`
        nav.innerHTML = `<div class="bank-nav-list">${tabs}</div>${entreContas}`
    }

    static _summaryForBank(month, bank) {
        const incomes = DataStore.getIncomesByMonth(month, bank)
        const allExpenses = DataStore.getExpensesByMonth(month, bank)
        const expenses = allExpenses.filter(e => !(e.externalId && e.externalId.startsWith('fixed:')))
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
            // Só lista bancos com movimento (esconde os zerados)
            const visibleItems = items.filter(r => r[valueKey] > 0)
            const sectionTotal = visibleItems.reduce((s, r) => s + r[valueKey], 0)
            const legend = visibleItems.map(r => {
                const meta = BANK_META[r.bank] || BANK_META.generico
                const pct = sectionTotal > 0 ? Math.round(r[valueKey] / sectionTotal * 100) : 0
                return `<div style="margin-bottom:10px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                  <span style="display:flex;align-items:center;gap:5px">
                    <span style="width:9px;height:9px;border-radius:50%;background:${meta.color};flex-shrink:0"></span>
                    <span style="font-size:12px;color:var(--text2)">${meta.label}</span>
                  </span>
                  <span style="font-size:12px;font-weight:600">${this.fmt(r[valueKey])} <span style="font-size:10px;color:var(--text3);font-weight:400">${pct}%</span></span>
                </div>
                <div style="height:3px;border-radius:2px;background:rgba(0,0,0,0.07)">
                  <div style="height:100%;width:${pct}%;background:${meta.color};border-radius:2px"></div>
                </div>
              </div>`
            }).join('')
            const hasAnyValue = visibleItems.length > 0
            const inner = hasAnyValue
                ? `<div style="display:flex;gap:1.25rem;align-items:center;flex-wrap:wrap">
                <div style="width:130px;height:130px;flex-shrink:0">
                  <canvas id="${id}"></canvas>
                </div>
                <div style="flex:1;min-width:140px">${legend}</div>
              </div>`
                : `<div style="font-size:12px;color:var(--text3);padding:1rem 0;text-align:center">${emptyMsg}</div>`
            return `<div style="flex:1;min-width:240px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:1rem 1.1rem">
            <div style="font-size:13px;font-weight:600;color:${accentColor};margin-bottom:4px">${title}</div>
            <div style="font-size:22px;font-weight:700;color:var(--text);margin-bottom:14px;line-height:1">${hasAnyValue ? this.fmt(sectionTotal) : '—'}</div>
            ${inner}
          </div>`
        }

        // Badge "hoje" / "futuro" — comparando com o mês corrente real
        const todayMonth = new Date().toISOString().slice(0, 7)
        let monthBadge = ''
        if (month === todayMonth) monthBadge = '<span class="month-status-badge is-today">atual</span>'
        else if (month > todayMonth) monthBadge = '<span class="month-status-badge is-future">futuro</span>'

        el.innerHTML = `<div class="overview-card is-active">
      <div class="overview-header">
        <div>
          <div class="overview-title">${this.monthLabel(month)}${monthBadge ? ' ' + monthBadge : ''}</div>
          ${total.hasBalance ? `<div class="overview-emconta">Saldo nas contas <strong>${this.fmt(total.emConta)}</strong></div>` : ''}
        </div>
        <div class="overview-month-nav">
          <button class="overview-contas-btn" onclick="app.switchTab('analise')" title="Minhas Contas" aria-label="Minhas Contas">📒 Contas<span class="contas-badge" id="contas-badge" style="display:none"></span></button>
        </div>
      </div>
      ${hasAnyMovement ? `
      ${(() => {
        const data = DataStore.load()
        const [y, mo] = month.split('-').map(Number)
        const mkMonth = (offset) => {
          let m = mo - offset, yr = y
          if (m <= 0) { m += 12; yr -= 1 }
          return `${yr}-${String(m).padStart(2, '0')}`
        }
        const displayMonths = [mkMonth(2), mkMonth(1), month]
        const sum = (arr) => arr.reduce((s, e) => s + e.amount, 0)
        const cols = displayMonths.map(m => {
          const exp    = data.expenses.filter(e => e.month === m)
          const renda  = sum(data.incomes.filter(i => i.month === m))
          const gasto  = sum(exp.filter(e => Classifier.sectorOf(e) === 'gasto' && e.sector !== 'entre_contas'))
          const aplic  = sum(exp.filter(e => Classifier.sectorOf(e) === 'investido' && !e.resgate))
          const resg   = sum(exp.filter(e => Classifier.sectorOf(e) === 'investido' && e.resgate))
          const invest = Math.max(0, aplic - resg)
          const [, mm] = m.split('-')
          return { key: m, label: MONTH_SHORT[parseInt(mm) - 1], renda, gasto, invest, isCurrent: m === month }
        })
        // Comparação textual com o mês imediatamente anterior
        const current = cols.find(c => c.isCurrent)
        const previous = cols.filter(c => !c.isCurrent).slice(-1)[0]
        if (!current || !previous || current.gasto === 0 || previous.gasto === 0) return ''

        const diff = current.gasto - previous.gasto
        if (diff === 0) return ''
        const absVal = this.fmt(Math.abs(diff))
        const direction = diff > 0 ? 'a mais' : 'a menos'
        const color = diff > 0 ? 'var(--red-text)' : 'var(--green-text)'
        const arrow = diff > 0 ? '↑' : '↓'
        const prevMonthIdx = parseInt(previous.key.split('-')[1], 10) - 1
        const prevMonthName = (MONTH_NAMES[prevMonthIdx] || previous.label).toLowerCase()

        return `<div class="evo-text">
          <span class="evo-text-arrow" style="color:${color}">${arrow}</span>
          Gastou <strong style="color:${color}">${absVal}</strong> ${direction} que ${prevMonthName}
        </div>`
      })()}
      <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:.75rem">
        ${mkDonutSection({ id: 'overviewDonutGasto',  items: gastoRows,  valueKey: 'gasto',     title: '💳 Gasto total',     accentColor: 'var(--red-text)',    bgColor: 'var(--red-bg)',    borderColor: 'var(--red)',    emptyMsg: 'Nenhum gasto registrado' })}
        ${total.investido > 0 ? mkDonutSection({ id: 'overviewDonutInvest', items: investRows, valueKey: 'investido', title: '📈 Investido total', accentColor: 'var(--purple-text)', bgColor: 'var(--purple-bg)', borderColor: 'var(--purple)', emptyMsg: 'Nenhum investimento registrado' }) : ''}
      </div>
      ${(() => {
          const allGastos = DataStore.getExpensesByMonth(month, null)
              .filter(e => Classifier.sectorOf(e) === 'gasto' && e.sector !== 'entre_contas')
          const fixoTotals = {}, varTotals = {}
          allGastos.forEach(e => {
              const key = e.category || 'outros'
              const target = e.type === 'fixo' ? fixoTotals : varTotals
              target[key] = (target[key] || 0) + e.amount
          })
          const hasAny = Object.keys(fixoTotals).length > 0 || Object.keys(varTotals).length > 0
          if (!hasAny) return ''
          const mkRow = ([cat, val], isFixed = false) => {
              const pct = total.gasto > 0 ? Math.round(val / total.gasto * 100) : 0
              const color = CAT_COLORS[cat] || '#888'
              const customCat = DataStore.getCustomCategories()[cat]
              const budget = customCat?.budget ?? null
              const budgetPct = budget ? Math.min(Math.round(val / budget * 100), 100) : 0
              const budgetOver = budget && val > budget
              const budgetNear = budget && !budgetOver && val / budget >= 0.8
              const budgetBarColor = budgetOver ? '#ef4444' : budgetNear ? '#f97316' : '#22c55e'
              const budgetLabel = budget
                ? `<span style="font-size:10px;color:${budgetOver ? '#ef4444' : budgetNear ? '#f97316' : 'var(--text3)'};">
                    ${budgetOver ? '⚠ ' : budgetNear ? '⚡ ' : ''}${this.fmt(val)} / ${this.fmt(budget)}
                  </span>`
                : `<span style="font-size:10px;color:var(--text3);font-weight:400">${pct}%</span>`
              const metaBtn = isFixed ? '' : `<button onclick="event.stopPropagation();app.editCategoryBudget('${cat}')" title="Definir meta de gasto" style="flex-shrink:0;padding:2px 7px;border-radius:6px;border:1px solid ${budget ? budgetBarColor + '55' : 'var(--border)'};background:${budget ? budgetBarColor + '18' : 'transparent'};color:${budget ? budgetBarColor : 'var(--text3)'};font-size:11px;font-weight:600;cursor:pointer;line-height:1.6;transition:all .15s" onmouseover="this.style.opacity='.75'" onmouseout="this.style.opacity='1'">🎯</button>`
              return `<div style="margin-bottom:10px;cursor:pointer;border-radius:6px;padding:4px 6px;margin-left:-6px;margin-right:-6px;transition:background .15s" onclick="app.showCategoryDetail('${cat}')" onmouseover="this.style.background='rgba(0,0,0,0.04)'" onmouseout="this.style.background='transparent'">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                  <span style="display:flex;align-items:center;gap:6px">
                    <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></span>
                    <span style="font-size:12px;color:var(--text2)">${this._catLabel(cat)}</span>
                    <button class="cat-rename-btn" onclick="event.stopPropagation();app.editCategoryName('${cat}','')" title="Renomear categoria"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>
                  </span>
                  <span style="display:flex;align-items:center;gap:5px">
                    <span style="font-size:12px;font-weight:600">${budget ? '' : this.fmt(val) + ' '} ${budgetLabel}</span>
                    ${metaBtn}
                    <span style="font-size:11px;color:var(--text3)">▸</span>
                  </span>
                </div>
                ${budget ? `
                <div style="height:5px;border-radius:3px;background:rgba(0,0,0,0.07);margin-bottom:2px">
                  <div style="height:100%;width:${budgetPct}%;background:${budgetBarColor};border-radius:3px;transition:width .3s"></div>
                </div>` : `
                <div style="height:3px;border-radius:2px;background:rgba(0,0,0,0.07)">
                  <div style="height:100%;width:${pct}%;background:${color};border-radius:2px"></div>
                </div>`}
              </div>`
          }
          const fmt = this.fmt.bind(this)
          const mkCard = (title, entries, isFixed = false) => {
              const sorted = [...entries].sort((a, b) => b[1] - a[1])
              // Agrupa categorias com valor < R$ 100 (só nas Variáveis)
              // Só agrupa se houver pelo menos 2 categorias pequenas (senão não vale)
              let mainEntries = sorted
              let smallEntries = []
              if (!isFixed) {
                  const SMALL_THRESHOLD = 100
                  const big = sorted.filter(([, v]) => v >= SMALL_THRESHOLD)
                  const small = sorted.filter(([, v]) => v < SMALL_THRESHOLD)
                  if (small.length >= 2) {
                      mainEntries = big
                      smallEntries = small
                  }
              }
              const smallTotal = smallEntries.reduce((s, [, v]) => s + v, 0)
              const smallHtml = smallEntries.length ? `
                <details class="cat-small-details">
                  <summary class="cat-small-summary">
                    <span>+ ${smallEntries.length} categorias menores</span>
                    <span><strong>${fmt(smallTotal)}</strong> <span class="chev">▾</span></span>
                  </summary>
                  <div class="cat-small-list">${smallEntries.map(e => mkRow(e, isFixed)).join('')}</div>
                </details>` : ''
              return `
            <div style="background:var(--surface2);border-radius:var(--r);padding:1rem 1.1rem;margin-bottom:.75rem">
              <div style="font-size:13px;font-weight:600;color:var(--text3);margin-bottom:8px">${title}</div>
              ${mainEntries.map(e => mkRow(e, isFixed)).join('')}
              ${smallHtml}
            </div>`
          }
          let result = ''
          if (Object.keys(fixoTotals).length > 0) result += mkCard('📌 Gastos Fixos', Object.entries(fixoTotals), true)
          if (Object.keys(varTotals).length > 0) result += mkCard('🔀 Gastos Variáveis', Object.entries(varTotals), false)
          return result
      })()}
      ` : `<div class="overview-empty-card">
        <span class="overview-empty-icon">📊</span>
        <div class="overview-empty-title">Nenhum dado consolidado</div>
        <div class="overview-empty-month">${this.monthLabel(month)}</div>
        <div class="overview-empty-hint">← deslize para os lados para navegar entre meses →</div>
      </div>`}
    </div>`
    }

    // Cores dos gráficos adaptam ao tema atual (light/dark)
    static _chartColors() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
        return {
            text: isDark ? '#B8B8D0' : '#888',
            grid: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
        }
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

    // Escapa para uso DENTRO de uma string JS que está DENTRO de um atributo HTML.
    // Ex: onclick="app.foo('${Renderer.jsAttr(userData)}')"
    // Sem isso, aspas simples no input quebram a string JS (esc() apenas não basta
    // porque o browser decodifica &#39; de volta para ' antes do JS parsear).
    static jsAttr(str) {
        const js = String(str ?? '')
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/\r/g, '\\r')
            .replace(/\n/g, '\\n')
            .replace(/\u2028/g, '\\u2028')
            .replace(/\u2029/g, '\\u2029')
            .replace(/</g, '\\x3c')
        return js
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
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

        // Gastos por categoria — separado em Fixos e Variáveis
        const gastoExpenses = expenses.filter(e => Classifier.sectorOf(e) === 'gasto')
        const catsFixo = {}, catsVar = {}
        gastoExpenses.forEach(e => {
            const target = e.type === 'fixo' ? catsFixo : catsVar
            target[e.category] = (target[e.category] || 0) + e.amount
        })
        const hasCats = Object.keys(catsFixo).length > 0 || Object.keys(catsVar).length > 0
        if (hasCats) {
            const mkRow = ([cat, val], isFixed = false) => {
                const pct = totalGasto > 0 ? Math.round(val / totalGasto * 100) : 0
                const color = CAT_COLORS[cat] || '#888'
                const customCat = DataStore.getCustomCategories()[cat]
                const budget = customCat?.budget ?? null
                const budgetPct = budget ? Math.min(Math.round(val / budget * 100), 100) : 0
                const budgetOver = budget && val > budget
                const budgetNear = budget && !budgetOver && val / budget >= 0.8
                const budgetBarColor = budgetOver ? '#ef4444' : budgetNear ? '#f97316' : '#22c55e'
                const budgetLabel = budget
                  ? `<span style="font-size:10px;color:${budgetOver ? '#ef4444' : budgetNear ? '#f97316' : 'var(--text3)'};">${budgetOver ? '⚠ ' : budgetNear ? '⚡ ' : ''}${this.fmt(val)} / ${this.fmt(budget)}</span>`
                  : `<span style="font-size:10px;color:var(--text3);font-weight:400">${pct}%</span>`
                const metaBtn = isFixed ? '' : `<button onclick="event.stopPropagation();app.editCategoryBudget('${cat}')" title="Definir meta de gasto" style="flex-shrink:0;padding:2px 7px;border-radius:6px;border:1px solid ${budget ? budgetBarColor + '55' : 'var(--border)'};background:${budget ? budgetBarColor + '18' : 'transparent'};color:${budget ? budgetBarColor : 'var(--text3)'};font-size:11px;font-weight:600;cursor:pointer;line-height:1.6;transition:all .15s" onmouseover="this.style.opacity='.75'" onmouseout="this.style.opacity='1'">🎯</button>`
                return `<div style="margin-bottom:10px;cursor:pointer;border-radius:6px;padding:4px 6px;margin-left:-6px;margin-right:-6px;transition:background .15s" onclick="app.showCategoryDetail('${cat}','${bank}')" onmouseover="this.style.background='rgba(0,0,0,0.04)'" onmouseout="this.style.background='transparent'">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                    <span style="display:flex;align-items:center;gap:6px">
                      <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></span>
                      <span style="font-size:12px;color:var(--text2)">${this._catLabel(cat)}</span>
                      <button class="cat-rename-btn" onclick="event.stopPropagation();app.editCategoryName('${cat}','${bank||''}')" title="Renomear categoria"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>
                    </span>
                    <span style="display:flex;align-items:center;gap:5px">
                      <span style="font-size:12px;font-weight:600">${budget ? '' : this.fmt(val) + ' '} ${budgetLabel}</span>
                      ${metaBtn}
                      <span style="font-size:11px;color:var(--text3)">▸</span>
                    </span>
                  </div>
                  ${budget ? `
                  <div style="height:5px;border-radius:3px;background:rgba(0,0,0,0.07);margin-bottom:2px">
                    <div style="height:100%;width:${budgetPct}%;background:${budgetBarColor};border-radius:3px;transition:width .3s"></div>
                  </div>` : `
                  <div style="height:3px;border-radius:2px;background:rgba(0,0,0,0.07)">
                    <div style="height:100%;width:${pct}%;background:${color};border-radius:2px"></div>
                  </div>`}
                </div>`
            }
            const mkCard = (title, map, isFixed = false) => `
                <div style="background:var(--surface2);border-radius:var(--r);padding:1rem 1.1rem;margin-bottom:.75rem">
                  <div style="font-size:13px;font-weight:600;color:var(--text3);margin-bottom:8px">${title}</div>
                  ${Object.entries(map).sort((a, b) => b[1] - a[1]).map(e => mkRow(e, isFixed)).join('')}
                </div>`
            if (Object.keys(catsFixo).length > 0) html += mkCard('📌 Gastos Fixos', catsFixo, true)
            if (Object.keys(catsVar).length > 0) html += mkCard('🔀 Gastos Variáveis', catsVar, false)
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
<button class="del-btn" onclick="app.removeIncome('${this.esc(i.id)}')" title="Excluir renda" aria-label="Excluir renda"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
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
        const allRaw = DataStore.getExpensesByMonth(month, bank)
        const query = (window.app?._expensesQuery || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
        const expanded = window.app?._expensesExpanded || {}
        const PAGE = 10

        const matchesQuery = (e) => {
            if (!query) return true
            const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
            return norm(e.name).includes(query) || norm(this.aliasName(e.name)).includes(query)
        }
        const all = allRaw.filter(matchesQuery)
        // Só gastos reais nesta aba — investimentos e movimentações 'em conta' não são saídas
        const gastos = all.filter(e => Classifier.sectorOf(e) === 'gasto')

        const formHtml = showForm ? `<div class="form-row">
      <input class="inp" id="exp-name" placeholder="Descrição..." style="min-width:120px" oninput="app._suggestExpenseCategory()">
      <input class="inp" id="exp-amount" type="number" min="0.01" step="0.01" placeholder="Valor (R$)" style="max-width:135px" oninput="app._suggestExpenseCategory()">
      <select class="sel" id="exp-sector">
        <option value="gasto">💳 Gasto</option>
        <option value="investido">📈 Investido</option>
        <option value="em_conta">🔄 Em conta</option>
      </select>
      <select class="sel" id="exp-type">
        <option value="variavel">Variável</option>
        <option value="fixo">Fixo</option>
      </select>
      <select class="sel" id="exp-cat" onchange="this.dataset.userTouched='1'">
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
            const sorted = [...list].sort((a, b) => {
                if (!a.dateStr && !b.dateStr) return 0
                if (!a.dateStr) return 1
                if (!b.dateStr) return -1
                const toISO = d => d.split('/').reverse().join('-')
                return toISO(b.dateStr).localeCompare(toISO(a.dateStr))
            })
            const isExpanded = expanded[sectorKey]
            const visible = (!query && !isExpanded) ? sorted.slice(0, PAGE) : sorted
            const remaining = sorted.length - visible.length

            visible.forEach(e => {
                const isFixo = e.type === 'fixo'
                const datePart = e.dateStr ? e.dateStr.slice(0, 5) : ''
                const subText = [datePart, this._catLabel(e.category)].filter(Boolean).join(' · ')
                h += `<div class="row">
          <div>
<div class="row-name">${this.esc(this.aliasName(e.name))}</div>
<div class="row-sub">${this.esc(subText)}</div>
          </div>
          <div class="row-right">
${isFixo ? `<span class="badge" style="background:var(--blue-bg);color:var(--blue-text)">Fixo</span>` : ''}
<span class="amount">${this.fmt(e.amount)}</span>
<button class="del-btn" onclick="app.removeExpense('${this.esc(e.id)}')" title="Excluir gasto" aria-label="Excluir gasto"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
          </div>
        </div>`
            })
            if (remaining > 0) {
                h += `<button class="show-more-btn" onclick="app._toggleExpensesGroup('${sectorKey}')">Ver mais ${remaining} ${SECTOR_LABELS[sectorKey].toLowerCase()}${remaining > 1 ? 's' : ''}</button>`
            } else if (isExpanded && sorted.length > PAGE) {
                h += `<button class="show-more-btn" onclick="app._toggleExpensesGroup('${sectorKey}')">Mostrar menos</button>`
            }
            h += `<div class="subtotal"><span>Subtotal ${SECTOR_LABELS[sectorKey].toLowerCase()}</span><span>${this.fmt(sub)}</span></div>`
            return h
        }

        // Barra de busca: aparece só quando há volume (>10 itens) ou já existe query ativa
        const showSearch = allRaw.length > 10 || !!query
        const searchHtml = showSearch ? `<div class="expenses-search-wrap">
            <input class="expenses-search" type="text" placeholder="🔍 Pesquisar movimentação..."
                value="${this.esc(window.app?._expensesQuery || '')}"
                oninput="app._setExpensesQuery(this.value)">
            ${query ? `<button class="expenses-search-clear" onclick="app._setExpensesQuery('')" title="Limpar">×</button>` : ''}
        </div>` : ''

        let body = searchHtml
        if (!gastos.length && !query) {
            body += `<div class="empty"><span class="empty-icon">↓</span>Nenhum gasto cadastrado para este mês</div>`
        } else if (!gastos.length) {
            body += `<div class="empty"><span class="empty-icon">🔍</span>Nenhum gasto encontrado para "${this.esc(window.app?._expensesQuery || '')}"</div>`
        } else {
            body += renderGroup(gastos, 'gasto')
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
        <span class="cat-name">${this._catLabel(cat)}</span>
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
                options: (() => {
                    const c = this._chartColors()
                    return {
                        responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
                        scales: {
                            x: { grid: { display: false }, ticks: { color: c.text, font: { size: 12 } } },
                            y: { grid: { color: c.grid }, ticks: { color: c.text, font: { size: 11 }, callback: v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v }, border: { display: false } }
                        }
                    }
                })()
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
                    labels: pieEntries.map(([c]) => this._catLabel(c)),
                    datasets: [{ data: pieEntries.map(([, v]) => Math.round(v * 100) / 100), backgroundColor: (BANK_PIE_COLORS[bank] || PIE_COLORS).slice(0, pieEntries.length), borderWidth: 0 }]
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
