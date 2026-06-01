// ─────────────────────────────────────────────────────────────────────────────
// DeletedHistoryUI — modal "Histórico de excluídos" e ação de restaurar
// ─────────────────────────────────────────────────────────────────────────────

Object.assign(FinanceApp.prototype, {

    openDeletedHistoryModal() {
        document.getElementById('user-dropdown')?.classList.remove('open')
        this._openModal(`
          <div class="modal-header"><span>🗑️ Histórico de excluídos</span></div>
          <div class="modal-body" style="padding-top:6px">
            <div id="deleted-history-list" style="min-height:120px;display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:13px">Carregando...</div>
          </div>`)
        this._loadDeletedHistory()
    },

    async _loadDeletedHistory() {
        const container = document.getElementById('deleted-history-list')
        if (!container) return
        try {
            const items = await ApiClient.get('/api/deleted-external-ids')
            this._renderDeletedHistory(items)
        } catch (e) {
            container.innerHTML = `<div style="text-align:center;color:var(--red-text);font-size:13px">Erro ao carregar histórico.</div>`
        }
    },

    _renderDeletedHistory(items) {
        const container = document.getElementById('deleted-history-list')
        if (!container) return
        if (!items.length) {
            container.style.display = 'flex'
            container.style.flexDirection = 'column'
            container.style.gap = '8px'
            container.innerHTML = `
              <span style="font-size:42px;opacity:.3">🗑️</span>
              <span>Nenhum gasto ou renda excluído ainda.</span>
              <span style="font-size:11px;color:var(--text3);max-width:280px;text-align:center;line-height:1.4">Quando você excluir um gasto que veio do sync do banco, ele aparece aqui. A qualquer momento dá pra restaurar.</span>`
            return
        }
        container.style.display = 'block'
        container.style.minHeight = '0'
        const fmt = Renderer.fmt.bind(Renderer)
        const fmtDate = (iso) => {
            const d = new Date(iso)
            return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
        }
        const meta = (bank) => (typeof BANK_META !== 'undefined' && BANK_META[bank]) || { label: bank, color: '#888' }
        container.innerHTML = `
          <div class="deleted-history-intro">
            ${items.length} item${items.length > 1 ? 's' : ''} no histórico. Restaurar traz de volta no próximo sync do banco.
          </div>
          <div class="deleted-history-rows">
            ${items.map(it => {
                const m = meta(it.bank)
                const kindIcon = it.kind === 'income' ? '⬆️' : '⬇️'
                const amountColor = it.kind === 'income' ? 'var(--green-text)' : 'var(--text)'
                return `
                <div class="deleted-history-row">
                  <div class="deleted-history-info">
                    <div class="deleted-history-name">${kindIcon} ${Renderer.esc(it.name)}</div>
                    <div class="deleted-history-meta">
                      <span style="color:${m.color};font-weight:600">${m.label}</span>
                      <span>${it.dateStr || ''}</span>
                      <span style="color:var(--text3)">excluído ${fmtDate(it.deletedAt)}</span>
                    </div>
                  </div>
                  <div class="deleted-history-actions">
                    <span class="deleted-history-amount" style="color:${amountColor}">${fmt(it.amount)}</span>
                    <button class="btn-restore" onclick="app._restoreDeletedItem('${Renderer.jsAttr(it.id)}','${Renderer.jsAttr(it.name)}')" title="Restaurar">↩</button>
                  </div>
                </div>`
            }).join('')}
          </div>`
    },

    async _restoreDeletedItem(id, name) {
        const confirmed = await this._showConfirmModal({
            title: 'Restaurar?',
            message: `Restaurar <strong>${Renderer.esc(name)}</strong>? Ele voltará a aparecer no próximo sincronização do banco.`,
            confirmLabel: 'Restaurar',
        })
        if (!confirmed) return
        try {
            await ApiClient.delete(`/api/deleted-external-ids/${id}`)
            this._showToast('✓ Item restaurado. Próximo sync trará de volta.', 'toast-success')
            this._loadDeletedHistory()
        } catch (e) {
            this._showToast('Erro ao restaurar.', 'toast-error')
        }
    },
})
