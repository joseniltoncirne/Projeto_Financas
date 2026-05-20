// ═══════════════════════════════════════════════════════════════════════════════
class AuthUI {
    constructor(onSuccess) {
        this.mode = 'login'
        this.onSuccess = onSuccess
    }

    showLogin() {
        this.mode = 'login'
        document.getElementById('tab-login').classList.add('active')
        document.getElementById('tab-register').classList.remove('active')
        this._render()
    }

    showRegister() {
        this.mode = 'register'
        document.getElementById('tab-register').classList.add('active')
        document.getElementById('tab-login').classList.remove('active')
        this._render()
    }

    _render() {
        const form = document.getElementById('auth-form')
        if (this.mode === 'register') {
            form.innerHTML = `
        <div class="auth-field">
          <label class="auth-label">Nome completo</label>
          <input class="auth-input" id="auth-name" type="text" placeholder="Ex: João Silva Souza" autocomplete="name">
          <span class="auth-hint">Sem abreviações — será usado para identificar suas transferências</span>
        </div>
        <div class="auth-field">
          <label class="auth-label">CPF</label>
          <input class="auth-input" id="auth-cpf" type="text" placeholder="000.000.000-00" maxlength="14" oninput="auth.maskCPF(this)" autocomplete="off">
        </div>
        <div class="auth-field">
          <label class="auth-label">Senha</label>
          <input class="auth-input" id="auth-pw" type="password" placeholder="Mínimo 6 caracteres" autocomplete="new-password">
        </div>
        <div class="auth-field">
          <label class="auth-label">Confirmar senha</label>
          <input class="auth-input" id="auth-pw2" type="password" placeholder="Repita a senha" autocomplete="new-password">
        </div>
        <div id="auth-error"></div>
        <button class="auth-btn" onclick="auth.submit()">Criar conta</button>`
        } else {
            form.innerHTML = `
        <div class="auth-field">
          <label class="auth-label">CPF</label>
          <input class="auth-input" id="auth-cpf" type="text" placeholder="000.000.000-00" maxlength="14" oninput="auth.maskCPF(this)" autocomplete="off">
        </div>
        <div class="auth-field">
          <label class="auth-label">Senha</label>
          <input class="auth-input" id="auth-pw" type="password" placeholder="Sua senha" autocomplete="current-password">
        </div>
        <div id="auth-error"></div>
        <button class="auth-btn" onclick="auth.submit()">Entrar</button>`
        }
        setTimeout(() => document.getElementById(this.mode === 'register' ? 'auth-name' : 'auth-cpf')?.focus?.(), 50)
    }

    maskCPF(input) {
        input.value = AuthService.formatCPF(input.value)
    }

    async submit() {
        const btn = document.querySelector('.auth-btn')
        if (btn) btn.disabled = true

        const cpfInput = document.getElementById('auth-cpf')
        const cpf = cpfInput?.value || ''
        const pw = document.getElementById('auth-pw')?.value || ''
        const errorEl = document.getElementById('auth-error')
        errorEl.innerHTML = ''

        const showError = (html) => {
            errorEl.innerHTML = html
            cpfInput?.classList.add('error')
            if (btn) btn.disabled = false
        }

        let result
        if (this.mode === 'register') {
            const name = document.getElementById('auth-name')?.value || ''
            const pw2 = document.getElementById('auth-pw2')?.value || ''
            if (pw !== pw2) {
                showError(`<div class="auth-error">As senhas não coincidem.</div>`)
                return
            }
            result = await AuthService.register(name, cpf, pw)
        } else {
            result = await AuthService.login(cpf, pw)
        }

        if (!result.ok) {
            if (result.error.includes('já cadastrado')) {
                const cleanCpf = cpf.replace(/\D/g, '')
                showError(`<div class="auth-error">
                    ${Renderer.esc(result.error)}
                    <button type="button"
                        onclick="auth.switchToLogin('${cleanCpf}')"
                        style="display:block;margin-top:8px;width:100%;padding:8px;border-radius:6px;border:1.5px solid currentColor;background:transparent;cursor:pointer;font-size:13px;font-weight:700;color:inherit">
                        Ir para login com este CPF →
                    </button>
                </div>`)
            } else {
                showError(`<div class="auth-error">${Renderer.esc(result.error)}</div>`)
            }
            return
        }

        this.onSuccess(result.session)
    }

    switchToLogin(cpfClean) {
        this.showLogin()
        setTimeout(() => {
            const f = document.getElementById('auth-cpf')
            if (f) { f.value = AuthService.formatCPF(cpfClean); f.dispatchEvent(new Event('input')) }
            document.getElementById('auth-pw')?.focus()
        }, 50)
    }

    toggleDropdown() {
        document.getElementById('user-dropdown').classList.toggle('open')
    }

    async logout() {
        await AuthService.logout()
        document.getElementById('user-dropdown').classList.remove('open')
        document.getElementById('app-header').style.display = 'none'
        document.getElementById('app-main').style.display = 'none'
        document.getElementById('auth-screen').style.display = 'flex'
        this.showLogin()
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLASS: DataStore — responsável por persistência no localStorage

window.AuthUI = AuthUI
