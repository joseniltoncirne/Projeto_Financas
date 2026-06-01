// ─────────────────────────────────────────────────────────────────────────────
// BankConnectionUI — integração com Pluggy para sync automático de transações
// ─────────────────────────────────────────────────────────────────────────────

Object.assign(FinanceApp.prototype, {

  async initBankConnections() {
    try {
      const connections = await ApiClient.get('/api/connections')
      this._renderConnectionsList(connections)
    } catch {
      this._renderConnectionsList([])
    }
  },

  openBanksModal() {
    // Fecha o dropdown caso esteja aberto
    document.getElementById('user-dropdown')?.classList.remove('open')
    const html = `
      <div class="modal-header"><span>🏦 Bancos conectados</span></div>
      <div class="modal-body" style="padding-top: 4px">
        <button class="conn-add-btn" style="width:100%;margin-bottom:14px" onclick="app.openPluggyWidget()">🔗 Conectar banco</button>
        <div id="connections-list"></div>
      </div>`
    this._openModal(html)
    // Cada abertura começa na lista, não num detalhe anterior
    this._selectedConnectionId = null
    this.initBankConnections()
  },

  _renderConnectionsList(connections) {
    const container = document.getElementById('connections-list')
    if (!container) return

    const bankMeta = BANK_META

    if (!connections.length) {
      container.innerHTML = `
        <div class="connections-empty">
          <span>🏦</span>
          <span>Nenhum banco conectado ainda</span>
        </div>`
      return
    }

    const statusLabel = {
      ok:      { text: 'Sincronizado', color: 'var(--green-text)' },
      syncing: { text: 'Sincronizando...', color: '#92400e' },
      error:   { text: 'Erro na última sync', color: '#991b1b' },
    }

    // Se o usuário selecionou um banco, mostra a view de detalhe
    const selected = connections.find(c => c.itemId === this._selectedConnectionId)
    if (selected) {
      this._renderConnectionDetail(container, selected, statusLabel)
      return
    }

    const chips = connections.map(conn => {
      const meta = bankMeta[conn.bank] || bankMeta.generico
      const statusClass = conn.status === 'error' ? 'is-error' : conn.status === 'syncing' ? 'is-syncing' : 'is-ok'
      const titleSuffix = ' (' + (statusLabel[conn.status]?.text || 'Conectado') + ')'
      return `<button class="bank-chip ${statusClass}" type="button" title="${meta.label}${titleSuffix}"
        onclick="app._selectConnection('${conn.itemId}')">
        ${meta.logo}
        <span class="bank-chip-dot"></span>
      </button>`
    }).join('')

    container.innerHTML = `
      <div class="connections-compact-card">
        <div class="bank-chips">${chips}</div>
      </div>`
  },

  _renderConnectionDetail(container, conn, statusLabel) {
    const meta = BANK_META[conn.bank] || BANK_META.generico
    const st = statusLabel[conn.status] || statusLabel.ok
    const isSyncing = conn.status === 'syncing'
    const fmt = dt => {
      if (!dt) return 'Nunca sincronizado'
      const d = new Date(dt)
      const diff = Date.now() - d.getTime()
      const mins = Math.floor(diff / 60000)
      if (mins < 1) return 'agora mesmo'
      if (mins < 60) return `há ${mins} min`
      const hrs = Math.floor(mins / 60)
      if (hrs < 24) return `há ${hrs}h`
      return `há ${Math.floor(hrs / 24)}d`
    }
    const labelEsc = (meta.label || '').replace(/'/g, '&#39;').replace(/"/g, '&quot;')

    container.innerHTML = `
      <div class="conn-detail">
        <button class="conn-detail-back" type="button" onclick="app._selectConnection(null)" title="Voltar">
          ← Voltar
        </button>
        <div class="conn-detail-card">
          <div class="conn-detail-header">
            <span class="conn-detail-logo">${meta.logo}</span>
            <div>
              <div class="conn-detail-name">${meta.label}</div>
              <div class="conn-detail-status" style="color:${st.color}">
                ${isSyncing ? '<span class="conn-spin">↻</span> ' : ''}${st.text}${!isSyncing ? ' ' + fmt(conn.lastSync) : ''}
              </div>
            </div>
          </div>
          <div class="conn-detail-actions">
            <button class="btn-primary" ${isSyncing ? 'disabled' : ''}
              onclick="app.syncBankConnection('${conn.itemId}')">
              ${isSyncing ? '↻ Sincronizando...' : '↻ Sincronizar agora'}
            </button>
            <button class="btn-danger-outline"
              onclick="app.disconnectBank('${conn.itemId}','${labelEsc}')">
              🗑 Desconectar banco
            </button>
          </div>
        </div>
      </div>`
  },

  _selectConnection(itemId) {
    this._selectedConnectionId = itemId
    this.initBankConnections()
  },

  async openPluggyWidget() {
    if (typeof PluggyConnect === 'undefined') {
      this._showToast('Widget Pluggy não carregado. Verifique sua conexão.', 'toast-error')
      return
    }

    let connectToken
    try {
      const res = await ApiClient.post('/api/connections/token', {})
      connectToken = res.connectToken
    } catch {
      this._showToast('Não foi possível iniciar a conexão com o banco.', 'toast-error')
      return
    }

    const pluggyConnect = new PluggyConnect({
      connectToken,
      onSuccess: async ({ item }) => {
        this._setLoading(true, 'Conectando banco e importando transações...')
        try {
          await this._saveConnection(item.id, item.connector?.name)
        } finally {
          this._setLoading(false)
        }
      },
      onError: (err) => {
        this._showToast('Erro ao conectar banco: ' + (err?.message || 'Tente novamente.'), 'toast-error')
      },
    })

    pluggyConnect.init()
  },

  async _saveConnection(itemId, connectorName) {
    try {
      await ApiClient.post('/api/connections', { itemId, connectorName: connectorName || '' })
      await DataStore._loadAll()
      this.currentBank = 'geral'
      this.render()
      await this.initBankConnections()
      this._showToast('✓ Banco conectado! Transações importadas automaticamente.', 'toast-success')
    } catch (err) {
      this._showToast('Erro ao salvar conexão: ' + (err?.message || 'Tente novamente.'), 'toast-error')
    }
  },

  async syncBankConnection(itemId) {
    const container = document.getElementById('connections-list')
    const btn = container?.querySelector(`button[onclick="app.syncBankConnection('${itemId}')"]`)
    if (btn) { btn.disabled = true; btn.textContent = '...' }

    try {
      const res = await ApiClient.post(`/api/connections/${itemId}/sync`, {})
      await DataStore._loadAll()
      this.render()
      await this.initBankConnections()
      const msg = res.synced > 0
        ? `✓ ${res.synced} transações novas importadas.`
        : '✓ Tudo atualizado — nenhuma transação nova.'
      this._showToast(msg, 'toast-success')
    } catch {
      this._showToast('Erro ao sincronizar. Tente novamente.', 'toast-error')
      if (btn) { btn.disabled = false; btn.textContent = '↻' }
    }
  },

  async syncAllBanks() {
    let connections = []
    try {
      connections = await ApiClient.get('/api/connections')
    } catch {
      this._showToast('Erro ao buscar bancos.', 'toast-error')
      return
    }
    if (!connections.length) {
      this._showToast('Nenhum banco conectado.', 'toast-info')
      return
    }
    const syncBtns = [document.getElementById('sync-all-btn-mobile')].filter(Boolean)
    syncBtns.forEach(b => { b.disabled = true; b.textContent = '...' })
    this._showToast('Sincronizando bancos...', 'toast-info')
    let total = 0
    let errors = 0
    for (const conn of connections) {
      try {
        const res = await ApiClient.post(`/api/connections/${conn.itemId}/sync`, {})
        total += res.synced || 0
      } catch {
        errors++
      }
    }
    await DataStore._loadAll()
    this.render()
    syncBtns.forEach(b => { b.disabled = false; b.textContent = '↻ Sincronizar' })
    if (errors > 0) {
      this._showToast(`${total} novas transações. ${errors} banco(s) com erro.`, 'toast-error')
    } else {
      this._showToast(total > 0 ? `✓ ${total} transações novas importadas.` : '✓ Tudo atualizado.', 'toast-success')
    }
  },

  _toggleConnMenu(itemId) {
    const dropdown = document.getElementById(`conn-dropdown-${itemId}`)
    if (!dropdown) return
    const isOpen = dropdown.style.display !== 'none'
    // Fecha todos os outros menus abertos
    document.querySelectorAll('.conn-dropdown').forEach(d => d.style.display = 'none')
    document.querySelectorAll('.conn-menu-wrap').forEach(w => w.classList.remove('open'))
    if (!isOpen) {
      dropdown.style.display = 'block'
      document.getElementById(`conn-menu-${itemId}`)?.classList.add('open')
      // Fecha ao clicar fora
      setTimeout(() => {
        const close = (e) => {
          if (!document.getElementById(`conn-menu-${itemId}`)?.contains(e.target)) {
            dropdown.style.display = 'none'
            document.getElementById(`conn-menu-${itemId}`)?.classList.remove('open')
            document.removeEventListener('click', close)
          }
        }
        document.addEventListener('click', close)
      }, 0)
    }
  },

  async disconnectBank(itemId, bankLabel) {
    const confirmed = await this._showConfirmModal({
      title: 'Desconectar banco',
      message: `Desconectar <strong>${Renderer.esc(bankLabel)}</strong>? As transações já importadas não serão removidas.`,
      confirmLabel: 'Desconectar',
      dangerous: true,
    })
    if (!confirmed) return

    try {
      await ApiClient.delete(`/api/connections/${itemId}`)
      await this.initBankConnections()
      this._showToast(`${bankLabel} desconectado.`, 'toast-info')
    } catch {
      this._showToast('Erro ao desconectar banco.', 'toast-error')
    }
  },
})
