// ═══════════════════════════════════════════════════════════════════════════════
class ImportService {
    constructor() {
        this.transactions = []
        this.saldoFinal = null
        this.saldoMonth = null
        this.bank = 'generico'
        this.userName = null
    }

    reset() {
        this.transactions = []
        this.saldoFinal = null
        this.saldoMonth = null
        this.bank = 'generico'
        this.userName = null
    }

    setUser(userName) {
        this.userName = userName
    }

    // ── OFX ────────────────────────────────────────────────────────────────────
    parseOFX(text) {
        this.bank = BankDetector.fromText(text, 'ofx')
        const transactions = []
        const body = text.replace(/\r/g, '')
        const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi
        const rules = DataStore.getRules()
        const amountRules = DataStore.getAmountRules()
        let match
        while ((match = trnRegex.exec(body)) !== null) {
            const block = match[1]
            const get = tag => { const r = new RegExp(`<${tag}>([^<\n\r]+)`, 'i'); const m = r.exec(block); return m ? m[1].trim() : '' }
            const dtpost = get('DTPOSTED')
            const amount = parseFloat(get('TRNAMT').replace(',', '.'))
            const memo = get('MEMO') || get('NAME') || 'Transação'
            if (isNaN(amount) || !dtpost) continue
            const y = dtpost.slice(0, 4), mo = dtpost.slice(4, 6), d = dtpost.slice(6, 8)
            transactions.push(Classifier.buildTransaction(memo, amount, `${d}/${mo}/${y}`, `${y}-${mo}`, this.bank, this.userName, rules, amountRules))
        }
        transactions.sort((a, b) => b.month.localeCompare(a.month) || b.dateStr.localeCompare(a.dateStr))
        this.transactions = transactions
        this.saldoFinal = null
        this.saldoMonth = null
    }

    // ── CSV ────────────────────────────────────────────────────────────────────
    parseCSV(text) {
        this.bank = BankDetector.fromText(text, 'csv')
        const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
        if (rawLines.length < 2) return

        const sep = rawLines.slice(0, 6).some(l => l.includes(';')) ? ';' : ','

        // Cabeçalho de metadados (formato Inter)
        let headerSaldo = null, headerMonth = null
        for (const line of rawLines.slice(0, 10)) {
            const cols = line.split(sep).map(c => c.replace(/"/g, '').trim())
            if (/^saldo$/i.test(cols[0]) && cols[1]) {
                const v = parseFloat(cols[1].replace(/\./g, '').replace(',', '.'))
                if (!isNaN(v)) headerSaldo = v
            }
            if (/^per[íi]odo$/i.test(cols[0]) && cols[1]) {
                const m = cols[1].match(/(\d{2})\/(\d{2})\/(\d{4})\s+a\s+(\d{2})\/(\d{2})\/(\d{4})/i)
                if (m) headerMonth = `${m[6]}-${m[5]}`
            }
        }

        // Encontra linha de cabeçalho das colunas
        let headerIdx = -1
        for (let i = 0; i < Math.min(rawLines.length, 15); i++) {
            const low = rawLines[i].toLowerCase()
            if ((low.includes('data') || low.includes('date')) && (low.includes('valor') || low.includes('value') || low.includes('amount'))) {
                headerIdx = i; break
            }
        }
        if (headerIdx === -1) throw new Error('Cabeçalho de colunas não encontrado no CSV.')

        const header = rawLines[headerIdx].split(sep).map(h => h.replace(/"/g, '').toLowerCase().trim())
        const findCol = keys => { for (const k of keys) { const i = header.findIndex(h => h === k || h.startsWith(k)); if (i !== -1) return i } return -1 }

        const iDate = findCol(['data lançamento', 'data lancamento', 'data', 'date', 'dt.lançamento'])
        const iAmount = findCol(['valor', 'value', 'amount', 'vlr'])
        const iDesc = findCol(['descrição', 'descricao', 'description', 'histórico', 'historico', 'memo', 'lançamento', 'lancamento'])
        const iDesc2 = findCol(['descrição', 'description', 'memo'])

        if (iDate === -1 || iAmount === -1 || iDesc === -1)
            throw new Error(`Colunas não reconhecidas. Encontradas: ${header.join(', ')}`)

        const transactions = []
        const rules = DataStore.getRules()
        const amountRules = DataStore.getAmountRules()
        for (let i = headerIdx + 1; i < rawLines.length; i++) {
            const cols = this._parseCSVLine(rawLines[i], sep)
            if (cols.length <= Math.max(iDate, iAmount, iDesc)) continue

            const rawDate = cols[iDate]?.replace(/"/g, '').trim()
            const rawAmount = cols[iAmount]?.replace(/"/g, '').trim()
            let memo = cols[iDesc]?.replace(/"/g, '').trim() || ''
            if (iDesc2 !== -1 && iDesc2 !== iDesc) {
                const extra = cols[iDesc2]?.replace(/"/g, '').trim()
                if (extra && extra !== memo) memo = `${memo} - ${extra}`
            }
            if (!rawDate || !rawAmount || !memo) continue

            const amount = this._parseAmount(rawAmount)
            if (isNaN(amount)) continue

            const { day, mo, year } = this._parseDate(rawDate)
            if (!day) continue

            const month = `${year}-${String(mo).padStart(2, '0')}`
            const dateStr = `${String(day).padStart(2, '0')}/${String(mo).padStart(2, '0')}/${year}`
            transactions.push(Classifier.buildTransaction(memo, amount, dateStr, month, this.bank, this.userName, rules, amountRules))
        }

        this.transactions = transactions
        this.saldoFinal = headerSaldo
        this.saldoMonth = headerMonth || (transactions.length ? transactions[0].month : null)
    }

    // ── PDF ────────────────────────────────────────────────────────────────────
    async parsePDF(file, onLoading) {
        onLoading(true)
        try {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
            const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
            const allLines = []

            for (let p = 1; p <= pdf.numPages; p++) {
                const content = await (await pdf.getPage(p)).getTextContent()
                const clusters = {}
                for (const item of content.items) {
                    if (!item.str?.trim()) continue
                    const y = Math.round(item.transform[5] / 4) * 4
                    if (!clusters[y]) clusters[y] = []
                    clusters[y].push({ str: item.str.trim(), x: item.transform[4] })
                }
                Object.keys(clusters).map(Number).sort((a, b) => b - a).forEach(y => {
                    const text = clusters[y].sort((a, b) => a.x - b.x).map(i => i.str).join(' ').trim()
                    if (text) allLines.push(text)
                })
            }

            // PDF baseado em imagem (escaneado) — tenta OCR
            if (allLines.length === 0) {
                const ocrLines = await this._ocrPDF(pdf, onLoading)
                allLines.push(...ocrLines)
            }

            this.bank = BankDetector.fromPDFLines(allLines)
            this._debugLines = allLines.slice(0, 100).join('\n')
            this._parsePDFLines(allLines)
        } finally {
            onLoading(false)
        }
    }

    async _ocrPDF(pdf, onLoading) {
        if (typeof Tesseract === 'undefined') {
            console.warn('[OCR] Tesseract.js não disponível.')
            return []
        }
        onLoading('OCR: carregando motor de reconhecimento...')
        const worker = await Tesseract.createWorker('por')
        const lines = []
        try {
            for (let p = 1; p <= pdf.numPages; p++) {
                onLoading(`OCR: analisando página ${p} de ${pdf.numPages}...`)
                const pdfPage = await pdf.getPage(p)
                const canvas = await this._renderPageToCanvas(pdfPage)
                const { data: { text } } = await worker.recognize(canvas)
                text.split('\n').forEach(l => { const t = l.trim(); if (t) lines.push(t) })
            }
        } finally {
            await worker.terminate()
        }
        return lines
    }

    async _renderPageToCanvas(pdfPage) {
        const viewport = pdfPage.getViewport({ scale: 2.5 })
        const canvas = document.createElement('canvas')
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        await pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
        return canvas
    }


    _parseCaixaPDFLines(lines) {
        // Detect new tabular format: "DD/MM/YYYY - HH:MM:SS  DOCNUM  DESC  AMOUNT D/C  BALANCE D/C"
        if (lines.some(l => /^\d{2}\/\d{2}\/\d{4}\s*-\s*\d{2}:\d{2}:\d{2}/.test(l.trim()))) {
            this._parseCaixaTabularLines(lines)
            return
        }

        const MONTHS_PT = {
            JAN: '01', FEV: '02', MAR: '03', ABR: '04', MAI: '05', JUN: '06',
            JUL: '07', AGO: '08', SET: '09', OUT: '10', NOV: '11', DEZ: '12'
        }

        let year = new Date().getFullYear().toString()
        for (const line of lines) {
            const m = line.match(/\d{1,2}\s+de\s+\w+\s+de\s+(\d{4})/i)
            if (m) { year = m[1]; break }
        }

        const TX_TYPES = [
            'pix enviado', 'pix recebido', 'deposito dinh', 'deposito loterico',
            'credito juros', 'crédito juros', 'correcao monetaria', 'correção monetária',
            'ted enviado', 'ted recebido', 'doc enviado', 'doc recebido',
            'saque', 'débito automatico', 'debito automatico', 'tarifa',
            'transferencia enviada', 'transferencia recebida',
            'transferência enviada', 'transferência recebida',
        ]

        const SKIP_RE = /^(saldo do dia|saldo anterior|ordenar|compartilhar|voltar|extrato por período|\d{1,2}\s+de\s+\w+\s+de\s+\d{4})/i
        const AMT_RE = /^(-\s*)?R\$\s*([\d.]+,\d{2})$/
        const DATE_RE = /^(\d{2})(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)$/i

        // Estratégia: acumula tudo por transação e só salva ao encontrar o próximo tipo
        // Ordem real: Tipo → Valor → Nome(s) → Data → Nome(s) extras → [próximo Tipo]
        const transactions = []
        const rules = DataStore.getRules()
        const amountRules = DataStore.getAmountRules()
        let txType = null, txAmount = null, descBuf = [], txDate = null, txMonth = null

        const flush = () => {
            if (!txType || txAmount === null || !txDate) return
            const desc = [txType, ...descBuf].filter(Boolean).join(' ').trim()
            transactions.push(Classifier.buildTransaction(desc, txAmount, txDate, txMonth, this.bank, this.userName, rules, amountRules))
            txType = null; txAmount = null; descBuf = []; txDate = null; txMonth = null
        }

        for (const raw of lines) {
            const t = raw.trim()
            if (!t || SKIP_RE.test(t)) continue

            // Tipo de transação → flush anterior e inicia novo
            const tLow = t.toLowerCase()
            const isType = TX_TYPES.some(tt => tLow.startsWith(tt))
            if (isType) {
                flush()
                txType = t; txAmount = null; descBuf = []; txDate = null; dateFound = false
                continue
            }

            // Valor
            const amtM = t.match(AMT_RE)
            if (amtM) {
                const val = parseFloat(amtM[2].replace(/\./g, '').replace(',', '.'))
                txAmount = amtM[1] ? -val : val
                continue
            }

            // Data — armazena mas NÃO faz flush ainda (pode ter mais linhas de nome)
            const dateM = t.match(DATE_RE)
            if (dateM) {
                const mo = MONTHS_PT[dateM[2].toUpperCase()]
                txDate = `${dateM[1]}/${mo}/${year}`
                txMonth = `${year}-${mo}`
                continue
            }

            // Linha de nome/descrição — aceita antes E depois da data
            if (txType) descBuf.push(t)
        }
        flush()

        // Saldo mais recente por data
        const saldosByDate = {}
        let lastDate = null
        for (const line of lines) {
            const dateM = line.trim().match(DATE_RE)
            if (dateM) {
                const mo = MONTHS_PT[dateM[2].toUpperCase()]
                lastDate = `${year}-${mo}-${dateM[1]}`
            }
            const saldoM = line.match(/saldo do dia\s+R\$\s*([\d.]+,\d{2})/i)
            if (saldoM && lastDate) {
                saldosByDate[lastDate] = parseFloat(saldoM[1].replace(/\./g, '').replace(',', '.'))
            }
        }
        const latestDate = Object.keys(saldosByDate).sort().reverse()[0]

        this.transactions = transactions
        this.saldoFinal = latestDate ? saldosByDate[latestDate] : null
        this.saldoMonth = transactions.length ? transactions.map(t => t.month).sort().reverse()[0] : null
    }


    _parseCaixaTabularLines(lines) {
        const CPF_MASK = /\*{2,}[\d.*]+\*{2,}/g
        // Row: DATE - TIME  DOCNUM  DESCRIPTION [BENEFICIARY [CPF]]  AMOUNT D/C  BALANCE D/C
        const ROW_RE = /^(\d{2}\/\d{2}\/\d{4})\s*-\s*\d{2}:\d{2}:\d{2}\s+\d+\s+(.*?)\s+([\d.]+,\d{2})\s+([DC])\s+([\d.]+,\d{2})\s+[DC]\s*$/

        const transactions = []
        const rules = DataStore.getRules()
        const amountRules = DataStore.getAmountRules()
        let lastBalance = null

        for (const raw of lines) {
            const m = raw.trim().match(ROW_RE)
            if (!m) continue

            const [, dateStr, descRaw, amtRaw, dc, balRaw] = m

            const bal = parseFloat(balRaw.replace(/\./g, '').replace(',', '.'))
            if (!isNaN(bal)) lastBalance = bal

            const amt = parseFloat(amtRaw.replace(/\./g, '').replace(',', '.'))
            if (isNaN(amt) || amt === 0) continue

            const desc = descRaw.replace(CPF_MASK, '').replace(/^[\s—–\-|]+/, '').replace(/\s{2,}/g, ' ').trim()
            if (!desc || /^saldo\s*d[oa]/i.test(desc)) continue

            const amount = dc === 'D' ? -amt : amt
            const [, mm, yyyy] = dateStr.split('/')
            const month = `${yyyy}-${mm}`

            transactions.push(Classifier.buildTransaction(desc, amount, dateStr, month, this.bank, this.userName, rules, amountRules))
        }

        this.transactions = transactions
        this.saldoFinal = lastBalance
        this.saldoMonth = transactions.length ? transactions.map(t => t.month).sort().reverse()[0] : null
    }


    _parsePDFLines(lines) {
        if (this.bank === 'caixa') { this._parseCaixaPDFLines(lines); return }
        const MONTHS_PT = { JAN: '01', FEV: '02', MAR: '03', ABR: '04', MAI: '05', JUN: '06', JUL: '07', AGO: '08', SET: '09', OUT: '10', NOV: '11', DEZ: '12' }
        const SKIP_RE = /^(saldo\s+(inicial|final)|rendimento|movimentaç|tem alguma|ouvidoria|cnpj|extrato gerado|nu\s+fin|nu\s+pag|valores em r\$|o saldo líq|não nos resp|asseguramos|agência\s+0001|\d+\s+de\s+\d+$)/i
        const AMT_END = /([\d.]+,\d{2})$/
        const ALONE = /^[\d.]+,\d{2}$/

        const transactions = []
        const rules = DataStore.getRules()
        const amountRules = DataStore.getAmountRules()
        let date = '', month = '', isIncome = null, descBuf = []

        const cleanDesc = s => s.replace(/agência[:\s]+\d+/gi, '').replace(/conta[:\s]+[\w-]+/gi, '').replace(/•{3}[^\s]*/g, '').replace(/[-–]\s*$/, '').replace(/\s{2,}/g, ' ').trim()

        // explicit=true: chamado com valor real da linha (inclui zeros); false: flush de transição entre blocos
        const flush = (amount, explicit = false) => {
            if (!date || !descBuf.length || isIncome === null) { descBuf = []; return }
            if (amount < 0 || (amount === 0 && !explicit)) { descBuf = []; return }
            const desc = cleanDesc(descBuf.join(' '))
            if (desc.length >= 4) transactions.push(Classifier.buildTransaction(desc, isIncome ? amount : -amount, date, month, this.bank, this.userName, rules, amountRules))
            descBuf = []
        }

        for (const raw of lines) {
            const t = raw.trim()
            if (!t || SKIP_RE.test(t)) continue
            const dm = t.match(/^(\d{2})\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s+(\d{4})/i)
            if (dm) {
                flush(0)
                const mo = MONTHS_PT[dm[2].toUpperCase()]
                date = `${dm[1]}/${mo}/${dm[3]}`
                month = `${dm[3]}-${mo}`
                if (/total de entradas/i.test(t)) isIncome = true
                else if (/total de sa[íi]das/i.test(t)) isIncome = false
                continue
            }
            if (/total de entradas/i.test(t)) { flush(0); isIncome = true; continue }
            if (/total de saídas/i.test(t)) { flush(0); isIncome = false; continue }
            if (!date) continue
            if (ALONE.test(t)) { flush(parseFloat(t.replace(/\./g, '').replace(',', '.')), true); continue }
            const am = t.match(AMT_END)
            if (am) {
                const amt = parseFloat(am[1].replace(/\./g, '').replace(',', '.'))
                const desc = t.slice(0, t.lastIndexOf(am[1])).replace(/[-–]\s*$/, '').trim()
                if (desc.length >= 3) { flush(0); descBuf = [desc]; flush(amt, true) }
                else flush(amt, true)
                continue
            }
            descBuf.push(t)
        }
        flush(0)

        // Extrai saldo final do período
        let saldoFinal = null
        for (const line of lines) {
            const m = line.match(/saldo final[^R\d]*(R\$\s*)?([\d.]+,\d{2})/i)
            if (m) { saldoFinal = parseFloat(m[2].replace(/\./g, '').replace(',', '.')); break }
        }
        if (saldoFinal === null) {
            for (let i = 0; i < lines.length; i++) {
                if (/saldo final/i.test(lines[i])) {
                    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
                        const m = lines[j].match(/^R?\$?\s*([\d.]+,\d{2})$/)
                        if (m) { saldoFinal = parseFloat(m[1].replace(/\./g, '').replace(',', '.')); break }
                    }
                    if (saldoFinal !== null) break
                }
            }
        }

        this.transactions = transactions
        this.saldoFinal = saldoFinal
        this.saldoMonth = transactions.length ? transactions.map(t => t.month).sort().reverse()[0] : null
    }

    // ── Utilitários ─────────────────────────────────────────────────────────────
    _parseAmount(raw) {
        const s = raw.replace(/\s/g, '')
        if (s.includes(',') && s.includes('.')) return parseFloat(s.replace(/\./g, '').replace(',', '.'))
        if (s.includes(',')) return parseFloat(s.replace(',', '.'))
        return parseFloat(s)
    }

    _parseDate(raw) {
        let day, mo, year
        const sep = raw.includes('/') ? '/' : raw.includes('-') ? '-' : null
        if (!sep) return {}
        const parts = raw.split(sep)
        if (parts[0].length === 4) [year, mo, day] = parts
        else[day, mo, year] = parts
        return { day, mo, year }
    }

    _parseCSVLine(line, sep) {
        const cols = []; let cur = '', inQuote = false
        for (const c of line) {
            if (c === '"') inQuote = !inQuote
            else if (c === sep && !inQuote) { cols.push(cur); cur = '' }
            else cur += c
        }
        cols.push(cur)
        return cols
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLASS: Renderer — responsável por toda renderização de HTML

window.ImportService = ImportService
