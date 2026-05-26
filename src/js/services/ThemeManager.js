// ═══════════════════════════════════════════════════════════════════════════════
// ThemeManager — light/dark com persistência em localStorage.
// O setAttribute inicial é feito por um script inline no <head> (evita flash).
// ═══════════════════════════════════════════════════════════════════════════════
class ThemeManager {
    static STORAGE_KEY = 'mf_theme'
    static ORDER = ['light', 'dark']
    static ICONS = { light: '☀️', dark: '🌙' }
    static LABELS = { light: 'Claro', dark: 'Escuro' }

    static get current() {
        const v = localStorage.getItem(this.STORAGE_KEY)
        return this.ORDER.includes(v) ? v : 'light'
    }

    static _apply() {
        if (this.current === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark')
        } else {
            document.documentElement.removeAttribute('data-theme')
        }
        this._syncButton()
        if (typeof window.app !== 'undefined' && window.app.render) {
            try { window.app.render() } catch { /* app pode estar não inicializado ainda */ }
        }
    }

    static _syncButton() {
        const btn = document.getElementById('header-theme-btn')
        if (!btn) return
        const c = this.current
        const next = this.ORDER[(this.ORDER.indexOf(c) + 1) % this.ORDER.length]
        btn.textContent = this.ICONS[c]
        btn.title = `Tema: ${this.LABELS[c]} (clique para ${this.LABELS[next]})`
    }

    static set(value) {
        if (!this.ORDER.includes(value)) return
        localStorage.setItem(this.STORAGE_KEY, value)
        this._apply()
    }

    static cycle() {
        const i = this.ORDER.indexOf(this.current)
        this.set(this.ORDER[(i + 1) % this.ORDER.length])
    }

    static init() {
        this._apply()
    }
}

window.ThemeManager = ThemeManager
ThemeManager.init()
