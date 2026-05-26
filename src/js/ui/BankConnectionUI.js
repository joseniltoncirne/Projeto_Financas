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
      ok:      { text: 'Sincronizado', color: 'var(--green-text)', bg: 'var(--green-bg)' },
      syncing: { text: 'Sincronizando...', color: '#92400e', bg: '#fef3c7' },
      error:   { text: 'Erro na última sync', color: '#991b1b', bg: '#fef2f2' },
    }

    const fmt = dt => {
      if (!dt) return 'Nunca sincronizado'
      const d = new Date(dt)
      const diff = Date.now() - d.getTime()
      const mins = Math.floor(diff / 60000)
      if (mins < 1) return 'Agora mesmo'
      if (mins < 60) return `há ${mins} min`
      const hrs = Math.floor(mins / 60)
      if (hrs < 24) return `há ${hrs}h`
      return `há ${Math.floor(hrs / 24)} dias`
    }

    container.innerHTML = connections.map(conn => {
      const meta = bankMeta[conn.bank] || bankMeta.generico
      const st = statusLabel[conn.status] || statusLabel.ok
      return `
        <div class="connection-item">
          <div class="connection-info">
            <span class="connection-icon">${meta.logo}</span>
            <div>
              <div class="connection-name">${meta.label}</div>
              <div class="connection-status" style="color:${st.color}">
                ${conn.status === 'syncing'
                  ? `<span class="conn-spin">↻</span> ${st.text}`
                  : `${st.text} · ${fmt(conn.lastSync)}`}
              </div>
            </div>
          </div>
          <div class="connection-actions">
            <button class="conn-btn conn-sync ${conn.status === 'syncing' ? 'conn-btn-disabled' : ''}"
              title="Sincronizar agora"
              onclick="app.syncBankConnection('${conn.itemId}')"
              ${conn.status === 'syncing' ? 'disabled' : ''}>↻</button>
            <div class="conn-menu-wrap" id="conn-menu-${conn.itemId}">
              <button class="conn-btn conn-more" title="Opções"
                onclick="app._toggleConnMenu('${conn.itemId}')">⋯</button>
              <div class="conn-dropdown" id="conn-dropdown-${conn.itemId}" style="display:none">
                <button class="conn-dropdown-item conn-dropdown-danger"
                  onclick="app._toggleConnMenu('${conn.itemId}');app.disconnectBank('${conn.itemId}','${meta.label}')">
                  Desconectar banco
                </button>
              </div>
            </div>
          </div>
        </div>`
    }).join('')
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
