Object.assign(FinanceApp.prototype, {

  async renderChecklist() {
    const el = document.getElementById('sec-analise')
    if (!el) return

    let items = []
    try {
      items = await ApiClient.get(`/api/fixed-expenses?month=${this.currentMonth}`)
      this._checklistItems = items
    } catch {
      el.innerHTML = '<div class="checklist-error">Erro ao carregar checklist.</div>'
      return
    }

    const month = this.currentMonth
    const paidIds = new Set(
      items.flatMap(i => i.payments.filter(p => p.month === month).map(p => p.expenseId))
    )
    const totalPaid = items.filter(i => i.payments.some(p => p.month === month)).length

    el.innerHTML = `
      <div class="checklist-wrap">
        <div class="checklist-header">
          <div>
            <div class="checklist-title">☑ Minhas Contas</div>
            <div class="checklist-sub">${totalPaid} de ${items.length} pagos em ${this._monthLabel(month)}</div>
          </div>
          <button class="checklist-add-btn" onclick="app._openAddFixedExpense()">+ Adicionar Conta</button>
        </div>

        ${items.length === 0 ? `
          <div class="checklist-empty">
            <span style="font-size:32px">📋</span>
            <span>Nenhum gasto fixo cadastrado ainda.</span>
            <span style="font-size:12px;color:var(--text3)">Adicione contas mensais como aluguel, streaming, academia...</span>
          </div>
        ` : `
          <div class="checklist-progress">
            <div class="checklist-progress-bar" style="width:${items.length ? Math.round(totalPaid / items.length * 100) : 0}%"></div>
          </div>
          <div class="checklist-list">
            ${items.map(item => {
              const payment = item.payments.find(p => p.month === month)
              const paid = !!payment
              const linkedExpense = paid && payment.expenseId ? DataStore.getExpenseById(payment.expenseId) : null
              return `
                <div class="checklist-item ${paid ? 'paid' : ''}" onclick="app._openLinkExpense('${item.id}')">
                  <div class="checklist-check">${paid ? '✓' : ''}</div>
                  <div class="checklist-info">
                    <div style="display:flex;align-items:center;gap:6px">
                      <div class="checklist-name">${Renderer.esc(item.name)}</div>
                      ${item.autoLinkName ? `<span class="checklist-autolink-badge" title="Vinculação automática ativa: &quot;${Renderer.esc(item.autoLinkName)}&quot;">🔗</span>` : ''}
                      <button class="checklist-edit-btn" title="Editar" onclick="event.stopPropagation();app._editFixedExpense('${item.id}')">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                      </button>
                    </div>
                    ${item.amount ? `<div class="checklist-amount">Previsto: ${Renderer.fmt(item.amount)}</div>` : ''}
                    ${item.endMonth ? (() => {
                      const startMonth = item.createdAt.slice(0, 7)
                      const total = this._monthSpan(startMonth, item.endMonth)
                      const current = Math.max(1, Math.min(total, this._monthSpan(startMonth, month)))
                      return `<div class="checklist-endmonth">parcela ${current}/${total}</div>`
                    })() : ''}
                    ${paid && linkedExpense ? `<div class="checklist-paid-label">Pago: ${Renderer.esc(linkedExpense.name)} · ${Renderer.fmt(linkedExpense.amount)}</div>` : ''}
                    ${paid && !linkedExpense ? `<div class="checklist-paid-label">Pago por outro meio ✓</div>` : ''}
                  </div>
                  <div class="checklist-item-actions" onclick="event.stopPropagation()">
                    ${!paid
                      ? `<button class="checklist-paid-btn" title="Marcar como pago" onclick="app._markPaid('${item.id}')">✓ Pago</button>`
                      : payment.autoCreated
                        ? `<button class="checklist-unpaid-btn" title="Desfazer pagamento" onclick="app._markUnpaid('${item.id}')">✕ Não Pago</button>`
                        : ''}
                    <button class="checklist-del-btn" title="Remover" onclick="app._deleteFixedExpense('${item.id}')">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    </button>
                  </div>
                </div>`
            }).join('')}
          </div>
        `}
      </div>`
  },

  _monthLabel(month) {
    const [y, m] = month.split('-')
    return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`
  },

  // Soma n meses a um YYYY-MM e retorna YYYY-MM
  _addMonths(month, n) {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 1 + n, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  },

  // Diferença em meses entre dois YYYY-MM (b - a), inclusivo: _monthSpan('2026-05','2026-07') = 3
  _monthSpan(from, to) {
    const [fy, fm] = from.split('-').map(Number)
    const [ty, tm] = to.split('-').map(Number)
    return (ty - fy) * 12 + (tm - fm) + 1
  },

  async _editFixedExpense(id) {
    const item = (this._checklistItems || []).find(i => i.id === id)
    if (!item) return
    const name = item.name
    const amount = item.amount
    const endMonth = item.endMonth
    const isPermanent = !endMonth
    // Parcelas restantes a partir do mês atual (mínimo 1)
    const remaining = endMonth ? Math.max(1, this._monthSpan(this.currentMonth, endMonth)) : ''
    const html = `
      <div class="modal-header"><span>Editar conta</span></div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:12px">
        <div>
          <label class="form-label">Nome</label>
          <input id="fe-edit-name" class="form-input" value="${Renderer.esc(name)}" autofocus>
        </div>
        <div>
          <label class="form-label">Valor previsto <span style="color:var(--text3);font-weight:400">(opcional)</span></label>
          <div style="display:flex;align-items:center;gap:0">
            <span style="padding:9px 10px;background:var(--surface2);border:1.5px solid var(--border);border-right:none;border-radius:8px 0 0 8px;font-size:13px;color:var(--text2);white-space:nowrap">R$</span>
            <input id="fe-edit-amount" class="form-input" type="number" step="0.01" min="0" placeholder="0,00" value="${amount ?? ''}" style="border-radius:0 8px 8px 0">
          </div>
        </div>
        <div>
          <label class="form-label">Duração</label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:8px">
            <input type="checkbox" id="fe-edit-permanent" ${isPermanent ? 'checked' : ''} onchange="app._onEditPermanentToggle()">
            <span style="font-size:13px">Conta permanente</span>
          </label>
          <div id="fe-edit-parcelas-wrap" style="display:${isPermanent ? 'none' : 'flex'};align-items:center;gap:8px">
            <input id="fe-edit-parcelas" class="form-input" type="number" min="1" step="1" placeholder="Ex: 12" value="${remaining}" style="max-width:100px">
            <span style="font-size:13px;color:var(--text2)">parcelas restantes a partir deste mês</span>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="app._closeModal()">Cancelar</button>
        <button class="btn-primary" onclick="app._saveEditFixedExpense('${id}')">Salvar</button>
      </div>`
    this._openModal(html)
    setTimeout(() => {
      const nameEl = document.getElementById('fe-edit-name')
      if (nameEl) { nameEl.focus(); nameEl.setSelectionRange(nameEl.value.length, nameEl.value.length) }
    }, 50)
  },

  _onEditPermanentToggle() {
    const isPermanent = document.getElementById('fe-edit-permanent')?.checked
    const wrap = document.getElementById('fe-edit-parcelas-wrap')
    if (wrap) wrap.style.display = isPermanent ? 'none' : 'flex'
  },

  async _saveEditFixedExpense(id) {
    const name = document.getElementById('fe-edit-name')?.value?.trim()
    const amountRaw = document.getElementById('fe-edit-amount')?.value
    if (!name) return
    const amount = amountRaw ? parseFloat(amountRaw) : undefined
    const isPermanent = document.getElementById('fe-edit-permanent')?.checked
    let endMonth = null
    if (!isPermanent) {
      const parcelas = parseInt(document.getElementById('fe-edit-parcelas')?.value || '0', 10)
      if (!parcelas || parcelas < 1) { this._showToast('Informe a quantidade de parcelas.', 'toast-error'); return }
      endMonth = this._addMonths(this.currentMonth, parcelas - 1)
    }
    try {
      await ApiClient.put(`/api/fixed-expenses/${id}`, { name, amount, endMonth })
      this._closeModal()
      await DataStore._loadAll()
      this._syncCustomCategories()
      this.render()
      this.renderChecklist()
    } catch {
      this._showToast('Erro ao salvar.', 'toast-error')
    }
  },

  async _openAddFixedExpense() {
    const html = `
      <div class="modal-header"><span>Nova conta fixa</span></div>
      <div class="modal-body fe-add-body">

        <div class="fe-field-group">
          <div class="fe-field-icon">📌</div>
          <div class="fe-field-content">
            <label class="fe-label">Nome da conta</label>
            <input id="fe-name" class="form-input" placeholder="Ex: Netflix, Aluguel, Academia...">
          </div>
        </div>

        <div class="fe-field-group">
          <div class="fe-field-icon">💰</div>
          <div class="fe-field-content">
            <label class="fe-label">Valor previsto <span class="fe-optional">(opcional)</span></label>
            <div class="fe-money-input">
              <span class="fe-money-prefix">R$</span>
              <input id="fe-amount" class="form-input" type="number" step="0.01" min="0" placeholder="0,00">
            </div>
          </div>
        </div>

        <div class="fe-field-group">
          <div class="fe-field-icon">📅</div>
          <div class="fe-field-content">
            <label class="fe-label">Parcelas</label>
            <div class="fe-parcelas-row" id="fe-parcelas-row">
              <input id="fe-parcelas" class="form-input fe-parcelas-input" type="number" min="1" step="1" placeholder="Qtd" oninput="app._onParcelasInput()">
              <span class="fe-parcelas-hint" id="fe-parcelas-hint">meses a cobrar</span>
            </div>
            <label class="fe-permanent-label">
              <input type="checkbox" id="fe-permanent" onchange="app._onAddPermanentToggle()">
              <span class="fe-permanent-check-icon"></span>
              <span>Conta permanente (sem data de encerramento)</span>
            </label>
            <div id="fe-endmonth-preview" class="fe-endmonth-preview" style="display:none"></div>
          </div>
        </div>

      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="app._closeModal()">Cancelar</button>
        <button class="btn-primary" onclick="app._saveFixedExpense()">Adicionar conta</button>
      </div>`
    this._openModal(html)
    setTimeout(() => document.getElementById('fe-name')?.focus(), 50)
  },

  _onAddPermanentToggle() {
    const isPermanent = document.getElementById('fe-permanent')?.checked
    const parcelasRow = document.getElementById('fe-parcelas-row')
    const preview = document.getElementById('fe-endmonth-preview')
    if (parcelasRow) parcelasRow.style.display = isPermanent ? 'none' : 'flex'
    if (preview) preview.style.display = 'none'
    if (isPermanent) {
      const parcelasInput = document.getElementById('fe-parcelas')
      if (parcelasInput) parcelasInput.value = ''
    }
  },

  _onParcelasInput() {
    const isPermanent = document.getElementById('fe-permanent')?.checked
    if (isPermanent) return
    const parcelas = parseInt(document.getElementById('fe-parcelas')?.value || '0', 10)
    const preview = document.getElementById('fe-endmonth-preview')
    if (!preview) return
    if (parcelas >= 1) {
      const endMonth = this._addMonths(this.currentMonth, parcelas - 1)
      const [y, m] = endMonth.split('-')
      preview.textContent = `Última cobrança: ${MONTH_NAMES[parseInt(m) - 1]} de ${y}`
      preview.style.display = 'block'
    } else {
      preview.style.display = 'none'
    }
  },

  async _saveFixedExpense() {
    const name = document.getElementById('fe-name')?.value?.trim()
    const amountRaw = document.getElementById('fe-amount')?.value
    if (!name) { this._showToast('Informe o nome da conta.', 'toast-error'); return }
    const amount = amountRaw ? parseFloat(amountRaw) : undefined
    const isPermanent = document.getElementById('fe-permanent')?.checked
    let endMonth = null
    if (!isPermanent) {
      const parcelas = parseInt(document.getElementById('fe-parcelas')?.value || '0', 10)
      if (!parcelas || parcelas < 1) { this._showToast('Informe a quantidade de parcelas ou marque como permanente.', 'toast-error'); return }
      endMonth = this._addMonths(this.currentMonth, parcelas - 1)
    }
    try {
      await ApiClient.post('/api/fixed-expenses', { name, amount, endMonth })
      this._closeModal()
      await DataStore._loadAll()
      this.renderChecklist()
    } catch {
      this._showToast('Erro ao salvar.', 'toast-error')
    }
  },

  _dismissRecurrenceSuggestion(key) {
    RecurrenceDetector.dismiss(key)
    this.render()
  },

  async _addRecurrenceSuggestion(name, amount) {
    const dismissKey = RecurrenceDetector._norm(name)
    const html = `
      <div class="modal-header"><span>Nova conta fixa</span></div>
      <div class="modal-body fe-add-body">
        <div class="fe-field-group">
          <div class="fe-field-icon">📌</div>
          <div class="fe-field-content">
            <label class="fe-label">Nome da conta</label>
            <input id="fe-name" class="form-input" value="${Renderer.esc(name)}">
          </div>
        </div>
        <div class="fe-field-group">
          <div class="fe-field-icon">💰</div>
          <div class="fe-field-content">
            <label class="fe-label">Valor previsto <span class="fe-optional">(opcional)</span></label>
            <div class="fe-money-input">
              <span class="fe-money-prefix">R$</span>
              <input id="fe-amount" class="form-input" type="number" step="0.01" min="0" value="${amount.toFixed(2)}">
            </div>
          </div>
        </div>
        <div class="fe-field-group">
          <div class="fe-field-icon">📅</div>
          <div class="fe-field-content">
            <label class="fe-label">Parcelas</label>
            <div class="fe-parcelas-row" id="fe-parcelas-row">
              <input id="fe-parcelas" class="form-input fe-parcelas-input" type="number" min="1" step="1" placeholder="Qtd" oninput="app._onParcelasInput()">
              <span class="fe-parcelas-hint" id="fe-parcelas-hint">meses a cobrar</span>
            </div>
            <label class="fe-permanent-label">
              <input type="checkbox" id="fe-permanent" onchange="app._onAddPermanentToggle()">
              <span class="fe-permanent-check-icon"></span>
              <span>Conta permanente (sem data de encerramento)</span>
            </label>
            <div id="fe-endmonth-preview" class="fe-endmonth-preview" style="display:none"></div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="app._closeModal()">Cancelar</button>
        <button class="btn-primary" onclick="app._saveFixedExpenseFromSuggestion('${Renderer.jsAttr(dismissKey)}')">Adicionar conta</button>
      </div>`
    this._openModal(html)
  },

  async _saveFixedExpenseFromSuggestion(dismissKey) {
    await this._saveFixedExpense()
    RecurrenceDetector.dismiss(dismissKey)
    this.render()
  },

  async _deleteFixedExpense(id) {
    const confirmed = await this._showConfirmModal({
      title: 'Remover gasto fixo',
      message: 'Remover este item do checklist? Os vínculos de meses anteriores serão perdidos.',
      confirmLabel: 'Remover',
      dangerous: true,
    })
    if (!confirmed) return
    try {
      await ApiClient.delete(`/api/fixed-expenses/${id}`)
      await DataStore._loadAll()
      this.render()
      this.renderChecklist()
    } catch {
      this._showToast('Erro ao remover.', 'toast-error')
    }
  },

  async _openLinkExpense(fixedId) {
    const month = this.currentMonth
    const fixedItem = (this._checklistItems || []).find(i => i.id === fixedId)
    if (!fixedItem) return
    const fixedName = fixedItem.name
    const currentPayment = fixedItem.payments.find(p => p.month === month)
    const currentExpenseId = currentPayment?.expenseId || null

    // Mapeia expenseId → nome da conta que o usa
    const usedByMap = {}
    ;(this._checklistItems || [])
      .filter(i => i.id !== fixedId)
      .forEach(i => {
        const p = i.payments.find(p => p.month === month && p.expenseId)
        if (p) usedByMap[p.expenseId] = i.name
      })

    const allExpenses = DataStore.getExpensesByMonth(month, this.currentBank === 'geral' ? null : this.currentBank)
      .filter(e => e.sector === 'gasto' && !(e.externalId && e.externalId.startsWith('fixed:')))

    const free     = allExpenses.filter(e => !usedByMap[e.id]).sort((a, b) => b.amount - a.amount)
    const occupied = allExpenses.filter(e =>  usedByMap[e.id]).sort((a, b) => b.amount - a.amount)

    const mkItem = (e, blocked = false) => {
      if (blocked) return `
        <div class="link-expense-item" style="opacity:.45;cursor:not-allowed;pointer-events:none;position:relative">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <div class="link-expense-name" style="color:var(--text3)">${Renderer.esc(e.name)}</div>
            <span style="flex-shrink:0;font-size:10px;font-weight:700;background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:2px 6px;color:var(--text3);white-space:nowrap">Já em uso</span>
          </div>
          <div class="link-expense-meta" style="margin-top:2px">
            ${e.dateStr ? `<span>${e.dateStr}</span>` : ''}
            <span style="color:var(--text3)">${Renderer.fmt(e.amount)}</span>
            <span style="font-size:10px;color:var(--text3)">· ${Renderer.esc(usedByMap[e.id])}</span>
          </div>
        </div>`
      return `
        <div class="link-expense-item ${e.id === currentExpenseId ? 'selected' : ''}"
          onclick="app._linkExpense('${fixedId}', '${e.id}')">
          <div class="link-expense-name">${Renderer.esc(e.name)}</div>
          <div class="link-expense-meta">
            ${e.dateStr ? `<span>${e.dateStr}</span>` : ''}
            <span style="font-weight:700;color:var(--text)">${Renderer.fmt(e.amount)}</span>
          </div>
        </div>`
    }

    const listHtml = free.length === 0 && occupied.length === 0
      ? '<div style="color:var(--text3);font-size:13px;padding:8px 0">Nenhum gasto encontrado neste mês.</div>'
      : [
          ...(occupied.length ? [`<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin:0 0 6px">Já vinculados a outras contas</div>`] : []),
          ...occupied.map(e => mkItem(e, true)),
          ...(occupied.length && free.length ? [`<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin:10px 0 6px">Disponíveis</div>`] : []),
          ...free.map(e => mkItem(e, false)),
        ].join('')

    const html = `
      <div class="modal-header"><span>Vincular pagamento</span></div>
      <div class="modal-body">
        <div style="font-size:13px;font-weight:600;margin-bottom:12px">
          ${Renderer.esc(fixedName)} — ${this._monthLabel(month)}
        </div>
        ${currentExpenseId ? `
          <div style="margin-bottom:12px">
            <button class="btn-danger-sm" onclick="app._unlinkExpense('${fixedId}')">
              ✕ Desvincular pagamento atual
            </button>
          </div>` : ''}
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-bottom:8px">
          Selecione o gasto correspondente:
        </div>
        <div class="link-expense-list">
          ${listHtml}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="app._closeModal()">Fechar</button>
      </div>`
    this._openModal(html)
  },

  async _linkExpense(fixedId, expenseId) {
    try {
      await ApiClient.post(`/api/fixed-expenses/${fixedId}/payment`, {
        month: this.currentMonth,
        expenseId,
        bank: this.currentBank === 'geral' ? 'generico' : this.currentBank,
      })
      this._closeModal()
      await DataStore._loadAll()
      this.render()
      this.renderChecklist()
      this._showToast('✓ Gasto vinculado.', 'toast-success')
    } catch {
      this._showToast('Erro ao vincular.', 'toast-error')
    }
  },

  async _unlinkExpense(fixedId) {
    try {
      await ApiClient.delete(`/api/fixed-expenses/${fixedId}/payment/${this.currentMonth}`)
      this._closeModal()
      await DataStore._loadAll()
      this.render()
      this.renderChecklist()
      this._showToast('Vínculo removido.', 'toast-info')
    } catch {
      this._showToast('Erro ao desvincular.', 'toast-error')
    }
  },

  async _markPaid(fixedId) {
    try {
      await ApiClient.post(`/api/fixed-expenses/${fixedId}/payment`, {
        month: this.currentMonth,
        bank: this.currentBank === 'geral' ? 'generico' : this.currentBank,
      })
      await DataStore._loadAll()
      this.render()
      this.renderChecklist()
      this._showToast('✓ Conta marcada como paga.', 'toast-success')
    } catch {
      this._showToast('Erro ao marcar como pago.', 'toast-error')
    }
  },

  async _markUnpaid(fixedId) {
    try {
      await ApiClient.delete(`/api/fixed-expenses/${fixedId}/payment/${this.currentMonth}`)
      await DataStore._loadAll()
      this.render()
      this.renderChecklist()
      this._showToast('Pagamento desfeito.', 'toast-info')
    } catch {
      this._showToast('Erro ao desfazer.', 'toast-error')
    }
  },
})
