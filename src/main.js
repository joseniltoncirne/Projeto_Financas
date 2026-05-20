// ═══════════════════════════════════════════════════════════════════════════════
// INIT — autenticação e inicialização
// ═══════════════════════════════════════════════════════════════════════════════

const app = new FinanceApp()
window.app = app

async function onLoginSuccess(session) {
    try {
        if (!session?.id || !session?.name) {
            throw new Error('Sessão inválida ou incompleta')
        }

        await DataStore.setUser(session.id)

        document.getElementById('user-name-display').textContent = AuthService.displayName(session.name)
        document.getElementById('user-dropdown-info').textContent = session.name
        const initials = session.name.trim().split(/\s+/).slice(0, 2).map(n => n[0].toUpperCase()).join('')
        document.getElementById('user-avatar').textContent = initials

        document.getElementById('auth-screen').style.display = 'none'
        document.getElementById('app-header').style.display = 'block'
        document.getElementById('app-main').style.display = 'block'

        app.currentUser = session
        app.init()
    } catch (error) {
        console.error('Erro ao iniciar o aplicativo:', error)
        await AuthService.logout()
        document.getElementById('app-header').style.display = 'none'
        document.getElementById('app-main').style.display = 'none'
        document.getElementById('auth-screen').style.display = 'flex'
        auth.showLogin()
    }
}

// Fecha dropdown ao clicar fora
document.addEventListener('click', e => {
    const btn = document.getElementById('user-btn')
    if (btn && !btn.contains(e.target)) {
        document.getElementById('user-dropdown')?.classList.remove('open')
    }
})

const auth = new AuthUI(onLoginSuccess)
window.auth = auth
auth.showLogin()

// Tenta restaurar a sessão automaticamente via refresh token armazenado
;(async () => {
    const session = AuthService.getSession()
    const refreshToken = ApiClient.getStoredRefreshToken()

    if (session?.id && refreshToken) {
        try {
            const res = await fetch(`${ApiClient.BASE}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken }),
            })
            if (res.ok) {
                const data = await res.json()
                ApiClient.setTokens(data.accessToken, data.refreshToken)
                await onLoginSuccess(session)
                return
            }
        } catch {}
        // Refresh falhou — limpa sessão e mostra login
        ApiClient.clearTokens()
        localStorage.removeItem(AuthService.SESSION_KEY)
    }
})()
