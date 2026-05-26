// ─────────────────────────────────────────────────────────────────────────────
// ImportUI — importação de extratos e modal entre contas
// ─────────────────────────────────────────────────────────────────────────────

Object.assign(FinanceApp.prototype, {

    onDragOver(e) { e.preventDefault(); e.stopPropagation(); document.getElementById('dropzone').classList.add('drag-over') },
    onDragLeave(e) { e.preventDefault(); document.getElementById('dropzone').classList.remove('drag-over') },

    onDrop(e) {
        e.preventDefault(); e.stopPropagation()
        document.getElementById('dropzone').classList.remove('drag-over')
        const file = e.dataTransfer.files[0]
        if (!file) return
        const ext = file.name.split('.').pop().toLowerCase()
        if (!['ofx', 'pdf', 'csv'].includes(ext)) {
            this._showToast('Formato não suportado. Use .CSV, .OFX ou .PDF.', 'toast-error')
            return
        }
        this._readFile(file)
    },

    handleFileInput(event) {
        const file = event.target.files[0]
        if (file) this._readFile(file)
        event.target.value = ''
    },

    _readFile(file) {
        const session = AuthService.getSession()
        const userName = this.currentUser?.name || session?.name || null
        const ext = file.name.split('.').pop().toLowerCase()

        if (ext === 'pdf') {
            const dz = document.getElementById('dropzone')
            const origHTML = dz.innerHTML
            const restoreDropzone = () => { dz.innerHTML = origHTML }

            this.importer.setUser(userName)
            this.importer.parsePDF(file, loading => {
                if (!loading) { dz.innerHTML = origHTML; return }
                const title = typeof loading === 'string' ? loading : 'Lendo PDF...'
                const sub = typeof loading === 'string' ? '' : '<div class="drop-sub">Aguarde um momento</div>'
                dz.innerHTML = `<span class="drop-icon" style="opacity:.6">⏳</span><div class="drop-title">${title}</div>${sub}`
            }).then(async () => {
                if (!this.importer.transactions.length) {
                    if (this.importer.saldoFinal !== null && this.importer.saldoMonth) {
                        try {
                            await DataStore.setBalance(this.importer.saldoMonth, this.importer.bank, this.importer.saldoFinal)
                            restoreDropzone()
                            this.currentBank = 'geral'
                            this.render()
                            this._showToast(`✓ Saldo de ${Renderer.fmt(this.importer.saldoFinal)} salvo com sucesso.`, 'toast-success')
                        } catch (err) {
                            restoreDropzone()
                            this._showToast('Erro ao salvar saldo.', 'toast-error')
                        }
                    } else {
                        this._showToast('Nenhuma transação encontrada no PDF.', 'toast-info')
                        restoreDropzone()
                    }
                    return
                }
                this._openImportModal()
            }).catch(err => {
                restoreDropzone()
                this._showToast('Erro ao ler o PDF: ' + err.message, 'toast-error')
            })
        } else {
            const reader = new FileReader()
            reader.onload = e => {
                try {
                    this.importer.reset()
                    this.importer.setUser(userName)
                    if (ext === 'csv') this.importer.parseCSV(e.target.result)
                    else this.importer.parseOFX(e.target.result)
                    if (!this.importer.transactions.length) {
                        this._showToast(`Nenhuma transação encontrada no arquivo ${ext.toUpperCase()}.`, 'toast-info')
                        return
                    }
                    this._openImportModal()
                } catch (err) {
                    this._showToast('Erro ao ler o arquivo: ' + err.message, 'toast-error')
                }
            }
            reader.readAsText(file, 'UTF-8')
        }
    },

    _openImportModal() {
        this.importPending = this.importer.transactions.map((t, idx) => ({ ...t, idx }))
        this._renderImportModal()
        document.getElementById('modal-overlay').classList.remove('hidden')
    },

    closeModal() {
        document.getElementById('modal-overlay').classList.add('hidden')
        this.importPending = []
        this.importer.reset()
    },

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
    },

    toggleImportRow(idx, checked) {
        this.importPending[idx].selected = checked
        document.getElementById('row-' + idx).className = checked ? '' : 'skip'
        const sel = this.importPending.filter(t => t.selected).length
        document.getElementById('modal-footer-info').textContent = `${sel} de ${this.importPending.length} transações selecionadas`
    },

    toggleAllImport(checked) {
        this.importPending.forEach((_, i) => {
            this.importPending[i].selected = checked
            const row = document.getElementById('row-' + i)
            if (row) row.className = checked ? '' : 'skip'
        })
        const sel = this.importPending.filter(t => t.selected).length
        document.getElementById('modal-footer-info').textContent = `${sel} de ${this.importPending.length} transações selecionadas`
    },

    setImportSector(idx, val) { this.importPending[idx].sector = val; this._renderImportModal() },
    setImportType(idx, val) { this.importPending[idx].expType = val },
    setImportCategory(idx, val) { this.importPending[idx].category = val },

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
    },

    async confirmImport() {
        const toImport = this.importPending.filter(t => t.selected)
        if (!toImport.length) {
            this._showToast('Nenhuma transação selecionada.', 'toast-info')
            return
        }

        const btn = document.querySelector('#modal-footer .add-btn')
        const origText = btn?.textContent
        if (btn) { btn.disabled = true; btn.textContent = 'Importando...' }
        this._setLoading(true, `Importando ${toImport.length} transações...`)

        try {
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
            this._showToast(`✓ ${toImport.length} transações importadas com sucesso!`, 'toast-success')
        } catch (err) {
            this._showToast('Erro ao importar transações. Tente novamente.', 'toast-error')
        } finally {
            this._setLoading(false)
            if (btn) { btn.disabled = false; btn.textContent = origText }
        }
    },

    openEntreContasModal() {
        const fmt = Renderer.fmt.bind(Renderer)
        const esc = Renderer.esc.bind(Renderer)
        const data = DataStore.load()
        const month = this.currentMonth
        const items = data.expenses.filter(e => e.month === month && e.sector === 'entre_contas')
        const total = items.reduce((s, e) => s + e.amount, 0)
        const [y, mo] = month.split('-')
        const monthName = `${MONTH_NAMES[parseInt(mo) - 1]} ${y}`

        document.getElementById('detail-title').textContent = `🔁 Entre contas — ${monthName}`
        let html = ''

        if (!items.length) {
            html += `<div class="empty"><span class="empty-icon">🔁</span>
        Nenhuma movimentação interna encontrada este mês.<br>
        <span style="font-size:12px">Transferências enviadas para você mesmo aparecerão aqui.</span>
      </div>`
        } else {
            html += `<div class="card">`
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
    },
})
