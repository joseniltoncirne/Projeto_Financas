// ═══════════════════════════════════════════════════════════════════════════════
class BankProfile {

    // Retorna o perfil correto para o banco detectado
    static get(bank) {
        const profiles = {
            nubank: this._nubank(),
            inter: this._inter(),
            caixa: this._caixa(),
            itau: this._itau(),
            bradesco: this._bradesco(),
            santander: this._santander(),
            bb: this._bb(),
            stone: this._stone(),
            original: this._original(),
            generico: this._generico(),
        }
        return profiles[bank] || profiles.generico
    }

    // Verifica se uma transação é resgate com base no perfil do banco
    static isResgate(memo, isIncome, bank) {
        const profile = this.get(bank)
        const m = memo.toLowerCase()
        if (profile.resgateKw.some(k => m.includes(k))) return true
        // Entradas que contêm palavras de investimento também são resgates
        if (isIncome && profile.investKw.some(k => m.includes(k))) return true
        return false
    }

    // Determina setor com base no perfil do banco
    static sector(memo, bank) {
        const profile = this.get(bank)
        const m = memo.toLowerCase()
        if (profile.investKw.some(k => m.includes(k))) return 'investido'
        if (profile.emContaKw.some(k => m.includes(k))) return 'em_conta'
        return 'gasto'
    }

    // ── Perfil Nubank ──────────────────────────────────────────────────────────
    static _nubank() {
        return {
            investKw: [
                'aplicação rdb', 'aplicacao rdb', 'dinheiro guardado', 'reserva programada',
                'rdb', 'cdb nubank', 'tesouro', 'previdência', 'vgbl', 'pgbl',
            ],
            // Apenas keywords que SÃO SEMPRE resgates independente da direção.
            // "dinheiro guardado com resgate planejado" NÃO entra aqui porque
            // como SAÍDA é uma aplicação — a direção isIncome=true cuida do caso entrada.
            resgateKw: [
                'resgate rdb', 'resgate cdb', 'resgate tesouro', 'resgate reserva',
            ],
            emContaKw: [
                'transferência recebida pelo pix',
                'transferencia recebida pelo pix', 'pix recebido', 'rendimento conta',
            ],
        }
    }

    // ── Perfil Inter ───────────────────────────────────────────────────────────
    static _inter() {
        return {
            investKw: [
                'cdb', 'lci', 'lca', 'tesouro', 'fundo', 'poupança inter', 'poupanca inter',
                'inter invest', 'aplicação', 'aplicacao', 'renda fixa', 'b3', 'bov',
                'crédito b3', 'credito b3', 'crédito evento b3', 'credito evento b3',
            ],
            resgateKw: [
                'resgate', 'cdb credito banco inter', 'cdb crédito banco inter',
                'resgate cdb', 'resgate lci', 'resgate lca', 'resgate fundo',
            ],
            emContaKw: [
                'pix recebido',
                'transferência recebida', 'transferencia recebida',
            ],
        }
    }

    // ── Perfil Caixa Econômica Federal ────────────────────────────────────────
    static _caixa() {
        return {
            investKw: [
                'poupança', 'poupanca', 'fgts', 'cdb caixa', 'lci caixa',
                'aplicação', 'aplicacao', 'tesouro', 'caderneta',
            ],
            resgateKw: [
                'resgate poupança', 'resgate poupanca', 'resgate cdb',
                'retirada poupança', 'retirada poupanca',
            ],
            emContaKw: [],
        }
    }

    // ── Perfil Itaú ────────────────────────────────────────────────────────────
    static _itau() {
        return {
            investKw: [
                'cdb itau', 'cdb itaú', 'lci itau', 'lci itaú', 'lca itau', 'lca itaú',
                'tesouro', 'fundo itau', 'fundo itaú', 'aplicação', 'aplicacao',
                'previdência', 'previdencia', 'vgbl', 'pgbl', 'renda fixa', 'iinvest',
                'aplicação automática', 'aplicacao automatica',
            ],
            resgateKw: [
                'resgate cdb', 'resgate lci', 'resgate lca', 'resgate fundo',
                'resgate tesouro', 'resgate previdência', 'resgate previdencia',
                'resgate aplicação', 'resgate aplicacao',
            ],
            emContaKw: [
                'pix recebido', 'transferência recebida', 'transferencia recebida',
                'ted recebido', 'doc recebido',
            ],
        }
    }

    // ── Perfil Bradesco ────────────────────────────────────────────────────────
    static _bradesco() {
        return {
            investKw: [
                'cdb bradesco', 'lci bradesco', 'lca bradesco', 'tesouro', 'fundo bradesco',
                'aplicação', 'aplicacao', 'previdência', 'previdencia', 'vgbl', 'pgbl',
                'renda fixa', 'poupança bradesco', 'poupanca bradesco', 'ágil',
            ],
            resgateKw: [
                'resgate cdb', 'resgate lci', 'resgate lca', 'resgate fundo',
                'resgate tesouro', 'resgate poupança', 'resgate poupanca',
            ],
            emContaKw: [
                'pix recebido', 'transferência recebida', 'transferencia recebida',
                'ted recebido', 'doc recebido',
            ],
        }
    }

    // ── Perfil Santander ───────────────────────────────────────────────────────
    static _santander() {
        return {
            investKw: [
                'cdb santander', 'lci santander', 'lca santander', 'tesouro',
                'fundo santander', 'aplicação', 'aplicacao', 'previdência', 'previdencia',
                'vgbl', 'pgbl', 'renda fixa', 'poupança santander', 'poupanca santander',
                'select investimento',
            ],
            resgateKw: [
                'resgate cdb', 'resgate lci', 'resgate lca', 'resgate fundo',
                'resgate tesouro', 'resgate poupança', 'resgate poupanca',
            ],
            emContaKw: [
                'pix recebido', 'transferência recebida', 'transferencia recebida',
                'ted recebido', 'doc recebido',
            ],
        }
    }

    // ── Perfil Banco do Brasil ─────────────────────────────────────────────────
    static _bb() {
        return {
            investKw: [
                'cdb bb', 'lci bb', 'lca bb', 'tesouro', 'fundo bb', 'aplicação', 'aplicacao',
                'previdência', 'previdencia', 'vgbl', 'pgbl', 'poupança', 'poupanca',
                'caderneta', 'renda fixa', 'bb renda', 'tesouro direto',
            ],
            resgateKw: [
                'resgate cdb', 'resgate lci', 'resgate lca', 'resgate fundo',
                'resgate tesouro', 'resgate poupança', 'resgate poupanca', 'resgate bb',
            ],
            emContaKw: [
                'pix recebido', 'transferência recebida', 'transferencia recebida',
                'ted recebido', 'doc recebido', 'credito em conta',
            ],
        }
    }

    // ── Perfil Stone ───────────────────────────────────────────────────────────
    static _stone() {
        return {
            investKw: [
                'cdb stone', 'aplicação', 'aplicacao', 'renda fixa', 'tesouro',
            ],
            resgateKw: [
                'resgate cdb', 'resgate stone', 'resgate aplicação', 'resgate aplicacao',
            ],
            emContaKw: [
                'pix recebido', 'transferência recebida', 'transferencia recebida',
                'recebimento stone', 'vendas stone',
            ],
        }
    }

    // ── Perfil Banco Original ──────────────────────────────────────────────────
    static _original() {
        return {
            investKw: [
                'cdb original', 'lci original', 'aplicação', 'aplicacao',
                'renda fixa', 'tesouro', 'fundo original',
            ],
            resgateKw: [
                'resgate cdb', 'resgate lci', 'resgate original',
                'resgate aplicação', 'resgate aplicacao',
            ],
            emContaKw: [
                'pix recebido', 'transferência recebida', 'transferencia recebida',
                'ted recebido',
            ],
        }
    }

    // ── Perfil Genérico (fallback) ─────────────────────────────────────────────
    static _generico() {
        return {
            investKw: [
                'aplicaç', 'aplicac', 'rdb', 'cdb', 'lci', 'lca', 'lft', 'tesouro', 'fundo',
                'dinheiro guardado', 'reserva', 'poupanç', 'poupanc', 'invest',
                'previdencia', 'previdência', 'vgbl', 'pgbl',
            ],
            resgateKw: [
                'resgate rdb', 'resgate cdb', 'resgate lci', 'resgate lca',
                'resgate tesouro', 'resgate fundo', 'resgate poupan',
            ],
            emContaKw: [
                'transferência recebida', 'transferencia recebida',
                'pix recebido', 'rendimento',
            ],
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLASS: Classifier — responsável por categorização e setor automático

window.BankProfile = BankProfile
