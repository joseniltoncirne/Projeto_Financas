// ═══════════════════════════════════════════════════════════════════════════════
class Classifier {
    static AUTO_CATS = {
        moradia: [
            'aluguel', 'condomin', 'portaria', 'sindico',
            'energia elet', 'conta de luz', 'luz eletrica', 'enel', 'cemig', 'copel', 'cpfl', 'coelba', 'celpe', 'neoenergia', 'eletropaulo', 'light s',
            'energisa', // Paraíba
            'conta de agua', 'agua e esgoto', 'sabesp', 'cedae', 'sanepar', 'embasa', 'cagece',
            'cagepa', // Companhia de Água e Esgotos da Paraíba
            'gas encanado', 'comgas', 'gas natural', 'ceg ',
            'internet', 'banda larga', 'fibra',
            'claro ', 'vivo ', 'tim ', 'oi ', 'net serv', 'sky ', 'brisanet', 'algar', 'sercomtel',
            'sumicity', // ISP de João Pessoa
            'iptu', 'seguro resid', 'seguro imovel',
        ],
        alimentacao: [
            'mercado', 'supermercado', 'hipermercado', 'minimercado', 'mercearia',
            'carrefour', 'extra ', 'pão de açúcar', 'pao de acucar', 'assai', 'atacadão', 'atacadao', 'prezunic', 'mundial ', 'guanabara', 'supernosso', 'superfresko', 'condor', 'muffato', 'angeloni', 'zaffari', 'giassi', 'bistek', 'bahamas', 'epa ', 'fort atacad', 'dia ', 'rede supermer',
            'gbarbosa', 'g.barbosa', // Nordeste
            'bompreco', 'bom preco', // Hiper Bom Preço — NE
            'bodega', // mini mercado típico do interior PB/NE
            'ifood', 'rappi', 'ubereats', 'uber eats', 'james delivery',
            'restaurante', 'lanchonete', 'lancheria', 'padaria', 'panificadora', 'confeitaria', 'doceria', 'sorveteria',
            'açougue', 'acougue', 'peixaria', 'hortifruti', 'quitanda', 'feira livre', 'frutaria',
            'mcdonalds', 'mc donalds', "mcdonald's", 'burger king', 'burguer king', 'subway', 'pizza', 'pizzaria', 'sushi', 'japonês', 'japones', 'churrascaria', 'hamburguer', 'hamburger', 'burger', 'hot dog', 'crepe', 'tapioca', 'pastelaria', 'pasteis', 'espetinho', 'espeto',
            'bar ', 'boteco', 'botequim', 'cervejaria', 'choperia',
            'acai', 'açaí', 'sorvete', 'gelato',
            'bebida', 'mercearia', 'food', 'delivery', 'refeição', 'refeicao',
        ],
        transporte: [
            'uber ', 'uberx', '99pop', '99 taxi', 'cabify', 'taxi', 'táxi', 'corrida',
            'mototaxi', // muito comum no interior da PB
            'posto ', 'combustivel', 'gasolina', 'etanol', 'diesel', 'alcool combust',
            'shell', 'ipiranga', 'br distribuidora', 'ale combustiveis', 'petrobras dist', 'raizen', 'vibra energia',
            'estacionamento', 'parking', 'zona azul',
            'sem parar', 'conectcar', 'veloe', 'move mais', 'autopass', 'via sul', 'grandespe',
            'pedágio', 'pedagio', 'ecovias', 'ecorodovias', 'cart ', 'arteris', 'ccr ', 'autopista',
            'metrô', 'metro ', 'cptm', 'supervia', 'trensurb', 'brt ', 'vlt ', 'trem ',
            'ônibus', 'onibus', 'bilhete unico', 'bilhete único', 'cartao transporte', 'riocard', 'stu ',
            'semob', // Sistema de ônibus de João Pessoa
            'progresso ', // empresa de ônibus regional do NE
            'latam', 'gol ', 'azul ', 'passagem aer', 'passagem viag',
            'ipva', 'licenciamento', 'dpvat', 'seguro auto', 'seguro veic',
            'oficina', 'mecanico', 'mecânico', 'revisão automovel', 'pneu', 'borracharia', 'autopeças', 'autopecas',
        ],
        saude: [
            'farmacia', 'farmácia', 'drogaria', 'drogasil', 'droga raia', 'raia ', 'pacheco', 'pague menos', 'ultrafarma', 'onofre', 'nissei', 'panvel', 'brair', 'redepharma', 'rede pharma', 'pharmacia', 'pharma',
            'hospital', 'clinica', 'clínica', 'pronto socorro', 'upa ',
            'hospital de trauma', 'hrt joao pessoa', // Hospital de Trauma de JP
            'medico', 'médico', 'consulta', 'odontologia', 'dentista', 'ortodontia', 'odontologo',
            'laboratorio', 'laboratório', 'exame', 'coleta', 'fleury', 'dasa', 'hermes pardini', 'sabin lab',
            'lafe', 'laboratorio farias', // Laboratório Farias e Filho — referência na PB
            'unimed', 'amil', 'hapvida', 'prevent', 'bradesco saude', 'sulamerica saude', 'notre dame', 'golden cross',
            'plano de saude', 'plano saude', 'convenio medico',
            'otica', 'ótica', 'oculista', 'lentes de contato',
            'psico', 'terapia', 'psiquiatra', 'fonoaudiologo', 'nutricionista', 'fisioterapia',
            'academia', 'smart fit', 'bluefit', 'bodytech', 'bio ritmo', 'crossfit', 'pilates', 'yoga',
        ],
        educacao: [
            'escola', 'colegio', 'colégio', 'creche', 'periodo integral', 'jardim de infancia',
            'faculdade', 'universidade', 'uni ', 'puc ', 'usp ', 'unifesp', 'insper', 'mackenzie', 'unip ', 'uninove', 'estacio',
            'ufpb', 'uepb', 'ufcg', 'ifpb', // universidades públicas da PB
            'unopar', // presente em JP e Campina Grande
            'mensalidade escolar', 'matricula', 'matrícula', 'semestralidade',
            'curso ', 'treinamento', 'capacitacao', 'capacitação',
            'udemy', 'alura', 'coursera', 'hotmart', 'eduzz', 'kiwify', 'skillshare', 'linkedin learning',
            'livraria', 'saraiva', 'cultura livros', 'fnac', 'amazon livros',
            'livro', 'apostila', 'material escolar', 'papelaria',
        ],
        lazer: [
            'netflix', 'spotify', 'amazon prime', 'disney', 'hbo max', 'apple tv', 'paramount', 'globoplay', 'crunchyroll', 'deezer', 'youtube premium', 'telecine',
            'steam', 'playstation', 'xbox', 'nintendo', 'nuuvem', 'epic games', 'riot games',
            'cinema', 'cinemark', 'cinepolis', 'uci cinemas', 'kinoplex',
            'teatro', 'show ', 'ingresso', 'bilheteria', 'ticketmaster', 'eventim', 'sympla', 'blueticket',
            'parque ', 'zoologico', 'aquario', 'museu',
            'hotel', 'pousada', 'resort', 'hostel', 'airbnb', 'booking', 'decolar', 'hurb',
            'decathlon', 'centauro', 'netshoes', 'dafiti', 'mundo da bola',
            'clube ', 'golf', 'golfe', 'quadra', 'boliche', 'laser tag',
        ],
        cartao: [
            'pagamento de fatura', 'pagamento fatura', 'pgto fatura', 'pag fatura', 'debito fatura',
            'fatura cartão', 'fatura cartao', 'fatura nubank', 'fatura inter', 'fatura bradesco',
            'fatura itau', 'fatura itaú', 'fatura santander', 'fatura caixa', 'fatura bb',
            'fatura banco', 'fatura credito', 'fatura crédito', 'fatura visa', 'fatura master',
        ],
    }

    // Normaliza o nome do destino para agrupamento e regras por valor:
    // remove prefixos bancários, substitui pontos por espaço, colapsa espaços e remove acentos
    static _normalizeKey(name) {
        let n = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        const prefixes = [
            'pix enviado ', 'pix recebido ', 'pix devolvido ',
            'ted enviado ', 'ted recebido ',
            'doc enviado ', 'doc recebido ',
            'transferencia para ', 'transferencia de ',
            'pagamento ', 'pgto ',
        ]
        for (const p of prefixes) {
            if (n.startsWith(p)) { n = n.slice(p.length); break }
        }
        return n.replace(/\./g, ' ').replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim()
    }

    static _categoryWithRules(memo, rules, amountRules = null, absAmount = undefined) {
        const m = memo.toLowerCase()
        if (amountRules && absAmount !== undefined) {
            const key = `${this._normalizeKey(memo)}::${Number(absAmount).toFixed(2)}`
            if (amountRules[key]) return amountRules[key]
        }
        if (rules[m]) return rules[m]
        for (const [cat, keywords] of Object.entries(this.AUTO_CATS)) {
            if (keywords.some(k => m.includes(k))) return cat
        }
        return 'outros'
    }

    static category(memo) {
        return this._categoryWithRules(memo, DataStore.getRules())
    }

    static sector(memo, bank = 'generico') {
        return BankProfile.sector(memo, bank)
    }

    static isResgate(memo, isIncome, bank = 'generico') {
        return BankProfile.isResgate(memo, isIncome, bank)
    }

    static sectorOf(expense) {
        return expense.sector || 'gasto'
    }

    // Verifica se uma transação é entre contas do mesmo titular
    // Suporta nome completo e abreviações (ex: "Josenilton C R Neto")
    static isInternalTransfer(memo, isOutgoing, userName) {
        if (!userName || !isOutgoing) return false

        const m = memo.toUpperCase().trim()
        const u = userName.toUpperCase().trim()
        const parts = u.split(/\s+/).filter(p => p.length > 1)

        if (!parts.length) return false

        // ── Nível 1: match exato (nome completo presente) ───────────────────────
        if (m.includes(u)) return true

        // ── Nível 2: primeiro nome + último sobrenome ambos presentes ────────────
        const first = parts[0]
        const last = parts[parts.length - 1]
        if (first !== last && m.includes(first) && m.includes(last)) return true

        // ── Nível 3: pelo menos 3 partes do nome completo presentes ──────────────
        // Ignora partículas curtas (de, da, do, dos, das)
        const significant = parts.filter(p => p.length >= 3)
        if (significant.length >= 3) {
            const matches = significant.filter(p => m.includes(p))
            if (matches.length >= 3) return true
        }

        return false
    }

    static buildTransaction(memo, amount, dateStr, month, bank = 'generico', userName = null, rules = null, amountRules = null) {
        const isIncome = amount > 0
        const absAmount = Math.abs(amount)
        const resgate = this.isResgate(memo, isIncome, bank)
        const internal = !isIncome && !resgate && this.isInternalTransfer(memo, !isIncome, userName)
        const sector = resgate ? 'investido' :
            internal ? 'entre_contas' :
                !isIncome ? this.sector(memo, bank) : null
        const id = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`
        const _rules = rules || DataStore.getRules()
        const _amountRules = amountRules || DataStore.getAmountRules()
        return {
            id,
            month, dateStr, memo, amount: absAmount,
            isIncome: isIncome && !resgate,
            resgate, sector, internal,
            category: (!isIncome && !resgate && !internal) ? this._categoryWithRules(memo, _rules, _amountRules, absAmount) : null,
            expType: 'variavel',
            selected: true,
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLASS: ImportService — responsável por parsear CSV, OFX e PDF

window.Classifier = Classifier
