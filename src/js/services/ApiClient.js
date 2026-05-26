// ═══════════════════════════════════════════════════════════════════════════════
class ApiClient {
    static BASE = `http://${window.location.hostname}:3333`
    static _accessToken = null
    static _refreshToken = null

    static setTokens(accessToken, refreshToken) {
        this._accessToken = accessToken
        if (refreshToken !== undefined) {
            this._refreshToken = refreshToken
            if (refreshToken) localStorage.setItem('mf_rt', refreshToken)
            else localStorage.removeItem('mf_rt')
        }
    }

    static getStoredRefreshToken() {
        return this._refreshToken || localStorage.getItem('mf_rt')
    }

    static clearTokens() {
        this._accessToken = null
        this._refreshToken = null
        localStorage.removeItem('mf_rt')
    }

    static async _fetch(method, path, body) {
        const headers = { 'Content-Type': 'application/json' }
        if (this._accessToken) headers['Authorization'] = `Bearer ${this._accessToken}`
        const opts = { method, headers }
        if (body !== undefined) opts.body = JSON.stringify(body)

        let res = await fetch(`${this.BASE}${path}`, opts)

        if (res.status === 401 && this.getStoredRefreshToken()) {
            const ok = await this._tryRefresh()
            if (ok) {
                headers['Authorization'] = `Bearer ${this._accessToken}`
                res = await fetch(`${this.BASE}${path}`, { ...opts, headers })
            }
        }

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: res.statusText }))
            const e = new Error(err.message || res.statusText)
            e.status = res.status
            e.body = err
            throw e
        }

        if (res.status === 204) return null
        return res.json()
    }

    static async _tryRefresh() {
        try {
            const rt = this.getStoredRefreshToken()
            if (!rt) return false
            const res = await fetch(`${this.BASE}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: rt }),
            })
            if (!res.ok) { this.clearTokens(); return false }
            const data = await res.json()
            this.setTokens(data.accessToken, data.refreshToken || rt)
            return true
        } catch {
            this.clearTokens()
            return false
        }
    }

    static get(path) { return this._fetch('GET', path) }
    static post(path, body) { return this._fetch('POST', path, body) }
    static put(path, body) { return this._fetch('PUT', path, body) }
    static patch(path, body) { return this._fetch('PATCH', path, body) }
    static delete(path, body) { return this._fetch('DELETE', path, body) }
}

window.ApiClient = ApiClient
