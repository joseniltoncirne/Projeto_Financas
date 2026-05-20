// ═══════════════════════════════════════════════════════════════════════════════
class BankDetector {

    // Detecta banco a partir de texto (CSV ou OFX)
    static fromText(text, ext) {
        const sample = text.slice(0, 1500).toLowerCase()

        if (ext === 'ofx') return this._detectOFX(sample)
        if (ext === 'csv') return this._detectCSV(sample)
        return 'generico'
    }

    // Detecta banco a partir de linhas extraídas de PDF usando score por múltiplos critérios
    static fromPDFLines(lines) {
        const sample = lines.slice(0, 80).join(' ').toLowerCase()
        const scores = { nubank: 0, inter: 0, caixa: 0, itau: 0, bradesco: 0, santander: 0, bb: 0, stone: 0, original: 0 }

        if (sample.includes('nu pagamentos')) scores.nubank += 3
        if (sample.includes('nu financeira')) scores.nubank += 3
        if (sample.includes('nubank')) scores.nubank += 2
        if (sample.includes('agência 0001') || sample.includes('agencia 0001')) scores.nubank += 3
        if (sample.includes('roxinho')) scores.nubank += 1

        if (sample.includes('banco inter')) scores.inter += 3
        if (sample.includes('inter s.a')) scores.inter += 3
        if (sample.includes('extrato conta inter')) scores.inter += 2
        if (sample.includes('inter bank')) scores.inter += 2

        if (sample.includes('caixa economica')) scores.caixa += 3
        if (sample.includes('caixa federal')) scores.caixa += 3
        if (sample.includes('deposito dinh')) scores.caixa += 2
        if (sample.includes('saldo anterior') && sample.includes('saldo do dia')) scores.caixa += 2
        if (sample.includes('extrato caixa')) scores.caixa += 2
        if (sample.includes('extrato por período') || sample.includes('extrato por periodo')) scores.caixa += 3
        if (sample.includes('histórico/complemento') || sample.includes('historico/complemento')) scores.caixa += 3
        if (sample.includes('favorecido') && sample.includes('saldo anterior')) scores.caixa += 2

        if (sample.includes('itau unibanco')) scores.itau += 3
        if (sample.includes('banco itau')) scores.itau += 3
        if (sample.includes('itaú unibanco')) scores.itau += 3
        if (sample.includes('extrato itau') || sample.includes('extrato itaú')) scores.itau += 2

        if (sample.includes('banco bradesco')) scores.bradesco += 3
        if (sample.includes('bradesco s.a')) scores.bradesco += 3
        if (sample.includes('extrato bradesco')) scores.bradesco += 2

        if (sample.includes('banco santander')) scores.santander += 3
        if (sample.includes('santander brasil')) scores.santander += 3
        if (sample.includes('extrato santander')) scores.santander += 2

        if (sample.includes('banco do brasil')) scores.bb += 3
        if (sample.includes('bb s.a') || sample.includes('bb s/a')) scores.bb += 3
        if (sample.includes('agencia bb') || sample.includes('agência bb')) scores.bb += 2
        if (sample.includes('extrato bb')) scores.bb += 2

        if (sample.includes('stone pagamentos')) scores.stone += 3
        if (sample.includes('banco stone')) scores.stone += 3
        if (sample.includes('stone co') || sample.includes('stone financeira')) scores.stone += 2

        if (sample.includes('banco original')) scores.original += 3
        if (sample.includes('original s.a')) scores.original += 2

        const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]
        if (best[1] > 0) return best[0]

        console.warn('[BankDetector] Banco não identificado no PDF — usando "generico". Se o extrato for de um banco conhecido, verifique as palavras-chave em BankDetector.fromPDFLines.')
        return 'generico'
    }

    static _detectOFX(sample) {
        if (sample.includes('nu pagamentos') || sample.includes('nu financeira') || sample.includes('nubank')) return 'nubank'
        if (sample.includes('banco inter') || sample.includes('inter s.a') || sample.includes('inter bank')) return 'inter'
        if (sample.includes('caixa economica') || sample.includes('caixa federal')) return 'caixa'
        if (sample.includes('itau unibanco') || sample.includes('banco itau') || sample.includes('itaú')) return 'itau'
        if (sample.includes('banco bradesco') || sample.includes('bradesco s.a')) return 'bradesco'
        if (sample.includes('banco santander') || sample.includes('santander brasil')) return 'santander'
        if (sample.includes('banco do brasil') || sample.includes('bb s.a') || sample.includes('bb s/a')) return 'bb'
        if (sample.includes('stone pagamentos') || sample.includes('banco stone')) return 'stone'
        if (sample.includes('banco original')) return 'original'
        console.warn('[BankDetector] Banco não identificado no OFX — usando "generico".')
        return 'generico'
    }

    static _detectCSV(sample) {
        if (sample.includes('identificador')) return 'nubank'
        if (sample.includes('extrato conta corrente') || sample.includes('banco inter')) return 'inter'
        if (sample.includes('caixa economica') || sample.includes('caixa federal')) return 'caixa'
        if (sample.includes('itau unibanco') || sample.includes('banco itau')) return 'itau'
        if (sample.includes('banco bradesco') || sample.includes('bradesco s.a')) return 'bradesco'
        if (sample.includes('banco santander') || sample.includes('santander brasil')) return 'santander'
        if (sample.includes('banco do brasil') || sample.includes('bb s.a')) return 'bb'
        if (sample.includes('stone pagamentos') || sample.includes('banco stone') || sample.includes('stone co')) return 'stone'
        if (sample.includes('banco original')) return 'original'
        console.warn('[BankDetector] Banco não identificado no CSV — usando "generico".')
        return 'generico'
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLASS: BankProfile — palavras-chave específicas por banco

window.BankDetector = BankDetector
