const BudgetNotifier = {
    _storageKey(month, categoryKey, threshold) {
        return `budget_notified::${month}::${categoryKey}::${threshold}`
    },

    _alreadyNotified(month, categoryKey, threshold) {
        return !!localStorage.getItem(this._storageKey(month, categoryKey, threshold))
    },

    _markNotified(month, categoryKey, threshold) {
        localStorage.setItem(this._storageKey(month, categoryKey, threshold), '1')
    },

    _clearNotified(month, categoryKey) {
        localStorage.removeItem(this._storageKey(month, categoryKey, '80'))
        localStorage.removeItem(this._storageKey(month, categoryKey, '100'))
    },

    async checkAfterBudgetSave(month, categoryKey) {
        this._clearNotified(month, categoryKey)
        await this.check(month)
    },

    _ensureStyles() {
        if (document.getElementById('budget-toast-styles')) return
        const style = document.createElement('style')
        style.id = 'budget-toast-styles'
        style.textContent = `
            #budget-toast-container {
                position: fixed;
                top: 16px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 8px;
                width: min(360px, calc(100vw - 32px));
                pointer-events: none;
            }
            .budget-toast {
                pointer-events: all;
                border-radius: 14px;
                padding: 14px 16px;
                display: flex;
                align-items: flex-start;
                gap: 12px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.10);
                animation: toast-in .3s cubic-bezier(.34,1.56,.64,1) both;
                position: relative;
                overflow: hidden;
            }
            .budget-toast.toast-out {
                animation: toast-out .25s ease-in forwards;
            }
            @keyframes toast-in {
                from { opacity: 0; transform: translateY(-18px) scale(.95); }
                to   { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes toast-out {
                from { opacity: 1; transform: translateY(0) scale(1); }
                to   { opacity: 0; transform: translateY(-12px) scale(.96); }
            }
            .budget-toast-progress {
                position: absolute;
                bottom: 0; left: 0;
                height: 3px;
                border-radius: 0 0 14px 14px;
                animation: toast-progress linear forwards;
            }
            @keyframes toast-progress {
                from { width: 100%; }
                to   { width: 0%; }
            }
            .budget-toast-icon {
                font-size: 22px;
                line-height: 1;
                flex-shrink: 0;
                margin-top: 1px;
            }
            .budget-toast-body { flex: 1; min-width: 0; }
            .budget-toast-title {
                font-size: 13px;
                font-weight: 700;
                line-height: 1.3;
                margin-bottom: 3px;
            }
            .budget-toast-msg {
                font-size: 12px;
                opacity: .85;
                line-height: 1.4;
            }
            .budget-toast-close {
                flex-shrink: 0;
                background: none;
                border: none;
                cursor: pointer;
                opacity: .5;
                font-size: 16px;
                line-height: 1;
                padding: 0;
                margin-top: 1px;
                transition: opacity .15s;
            }
            .budget-toast-close:hover { opacity: 1; }
        `
        document.head.appendChild(style)
    },

    _getContainer() {
        let el = document.getElementById('budget-toast-container')
        if (!el) {
            el = document.createElement('div')
            el.id = 'budget-toast-container'
            document.body.appendChild(el)
        }
        return el
    },

    _showToast(icon, title, message, color, duration = 6000) {
        this._ensureStyles()
        const container = this._getContainer()

        const toast = document.createElement('div')
        toast.className = 'budget-toast'
        toast.style.cssText = `background:${color.bg};color:${color.text};border:1px solid ${color.border};`
        toast.innerHTML = `
            <span class="budget-toast-icon">${icon}</span>
            <div class="budget-toast-body">
                <div class="budget-toast-title">${title}</div>
                <div class="budget-toast-msg">${message}</div>
            </div>
            <button class="budget-toast-close" title="Fechar">✕</button>
            <div class="budget-toast-progress" style="background:${color.progress};animation-duration:${duration}ms"></div>
        `

        const dismiss = () => {
            toast.classList.add('toast-out')
            setTimeout(() => toast.remove(), 260)
        }

        toast.querySelector('.budget-toast-close').addEventListener('click', dismiss)
        container.appendChild(toast)
        setTimeout(dismiss, duration)
    },

    async check(month) {
        const expenses = DataStore.getExpensesByMonth(month, null)
        const custom = DataStore.getCustomCategories()

        const totals = {}
        expenses
            .filter(e => e.sector === 'gasto')
            .forEach(e => {
                const key = e.category || 'outros'
                totals[key] = (totals[key] || 0) + e.amount
            })

        for (const [key, spent] of Object.entries(totals)) {
            const cat = custom[key]
            if (!cat?.budget) continue

            const pct = spent / cat.budget
            const label = (typeof CAT_LABELS !== 'undefined' && CAT_LABELS[key]) || cat.label || key

            if (pct >= 1 && !this._alreadyNotified(month, key, '100')) {
                this._markNotified(month, key, '100')
                this._showToast(
                    '⚠️',
                    `Meta ultrapassada: ${label}`,
                    `Você gastou ${Renderer.fmt(spent)} de ${Renderer.fmt(cat.budget)} previstos este mês.`,
                    { bg: '#fff1f2', text: '#991b1b', border: '#fecaca', progress: '#ef4444' }
                )
            } else if (pct >= 0.8 && pct < 1 && !this._alreadyNotified(month, key, '80')) {
                this._markNotified(month, key, '80')
                this._showToast(
                    '⚡',
                    `${label} em ${Math.round(pct * 100)}% da meta`,
                    `Faltam ${Renderer.fmt(cat.budget - spent)} para atingir o limite de ${Renderer.fmt(cat.budget)}.`,
                    { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa', progress: '#f97316' }
                )
            }
        }
    },
}
