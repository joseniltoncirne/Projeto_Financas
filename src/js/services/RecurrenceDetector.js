const RecurrenceDetector = {
    _DISMISS_KEY: 'recurrence_dismissed',
    _MIN_MONTHS: 2,
    _MAX_PER_MONTH: 2,
    _MAX_CV: 0.20,
    _MIN_AMOUNT: 10,
    _LOOKBACK: 4,

    _dismissed() {
        try { return new Set(JSON.parse(localStorage.getItem(this._DISMISS_KEY) || '[]')) } catch { return new Set() }
    },

    dismiss(key) {
        const d = [...this._dismissed(), key]
        localStorage.setItem(this._DISMISS_KEY, JSON.stringify([...new Set(d)]))
    },

    _norm(name) {
        return name.toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
    },

    detect() {
        const all = DataStore.load().expenses || []
        const dismissed = this._dismissed()

        const allMonths = [...new Set(all.map(e => e.month))].sort()
        const window = allMonths.slice(-this._LOOKBACK)
        if (window.length < this._MIN_MONTHS) return []

        const candidates = all.filter(e =>
            Classifier.sectorOf(e) === 'gasto' &&
            e.sector !== 'entre_contas' &&
            e.type !== 'fixo' &&
            !(e.externalId?.startsWith('fixed:')) &&
            window.includes(e.month)
        )

        const groups = {}
        for (const e of candidates) {
            const key = this._norm(e.name)
            if (!groups[key]) groups[key] = []
            groups[key].push(e)
        }

        const suggestions = []
        for (const [key, expenses] of Object.entries(groups)) {
            if (dismissed.has(key)) continue

            const byMonth = {}
            for (const e of expenses) {
                if (!byMonth[e.month]) byMonth[e.month] = []
                byMonth[e.month].push(e)
            }

            const monthsFound = Object.keys(byMonth).sort()
            if (monthsFound.length < this._MIN_MONTHS) continue
            if (Math.max(...Object.values(byMonth).map(a => a.length)) > this._MAX_PER_MONTH) continue

            const amounts = expenses.map(e => e.amount)
            const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length
            if (mean < this._MIN_AMOUNT) continue

            const cv = Math.sqrt(amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length) / mean
            if (cv > this._MAX_CV) continue

            const mostRecent = [...expenses].sort((a, b) => b.month.localeCompare(a.month))[0]
            suggestions.push({ key, name: mostRecent.name, amount: mean, months: monthsFound })
        }

        return suggestions.sort((a, b) => b.amount - a.amount)
    },
}
