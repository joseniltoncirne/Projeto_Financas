// ═══════════════════════════════════════════════════════════════════════════════
class AuthService {
    static SESSION_KEY = 'mf_session'

    static formatCPF(value) {
        const d = value.replace(/\D/g, '').slice(0, 11)
        if (d.length <= 3) return d
        if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
        if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
        return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
    }

    static validateCPF(cpf) {
        const d = cpf.replace(/\D/g, '')
        if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
        let sum = 0
        for (let i = 0; i < 9; i++) sum += +d[i] * (10 - i)
        let r = (sum * 10) % 11; if (r === 10 || r === 11) r = 0
        if (r !== +d[9]) return false
        sum = 0
        for (let i = 0; i < 10; i++) sum += +d[i] * (11 - i)
        r = (sum * 10) % 11; if (r === 10 || r === 11) r = 0
        return r === +d[10]
    }

    static validateName(name) {
        const parts = name.trim().split(/\s+/)
        return parts.length >= 2 && parts.every(p => p.length >= 2)
    }

    static async register(fullName, cpf, password) {
        const name = fullName.trim().toUpperCase()
        const clean = cpf.replace(/\D/g, '')
        if (!this.validateName(name)) return { ok: false, error: 'Informe nome e sobrenome completos (sem abreviações)' }
        if (!this.validateCPF(cpf)) return { ok: false, error: 'CPF inválido' }
        if (!password || password.length < 10) return { ok: false, error: 'A senha deve ter pelo menos 10 caracteres' }
        try {
            const data = await ApiClient.post('/auth/register', { name, cpf: clean, password })
            ApiClient.setTokens(data.accessToken, data.refreshToken)
            const session = { id: data.user.id, name: data.user.name, cpf: data.user.cpf }
            localStorage.setItem(this.SESSION_KEY, JSON.stringify(session))
            return { ok: true, session }
        } catch (e) {
            if (e.status === 409) return { ok: false, error: 'CPF já cadastrado. Faça login.' }
            return { ok: false, error: e.message || 'Erro ao criar conta.' }
        }
    }

    static async login(cpf, password) {
        const clean = cpf.replace(/\D/g, '')
        if (!this.validateCPF(cpf)) return { ok: false, error: 'CPF inválido' }
        if (!password) return { ok: false, error: 'Informe sua senha.' }
        try {
            const data = await ApiClient.post('/auth/login', { cpf: clean, password })
            ApiClient.setTokens(data.accessToken, data.refreshToken)
            const session = { id: data.user.id, name: data.user.name, cpf: data.user.cpf }
            localStorage.setItem(this.SESSION_KEY, JSON.stringify(session))
            return { ok: true, session }
        } catch (e) {
            if (e.status === 401 || e.status === 404) return { ok: false, error: 'CPF ou senha incorretos.' }
            return { ok: false, error: e.message || 'Erro ao fazer login.' }
        }
    }

    static async logout() {
        const refreshToken = ApiClient.getStoredRefreshToken()
        if (refreshToken) {
            await ApiClient.delete('/auth/logout', { refreshToken }).catch(() => {})
        }
        ApiClient.clearTokens()
        localStorage.removeItem(this.SESSION_KEY)
    }

    static getSession() {
        try { return JSON.parse(localStorage.getItem(this.SESSION_KEY)) } catch { return null }
    }

    static displayName(fullName) {
        const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean)
        return parts.length >= 2 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0]
    }
}

window.AuthService = AuthService
