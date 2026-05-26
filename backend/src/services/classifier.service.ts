// ─────────────────────────────────────────────────────────────────────────────
// ClassifierService — port do Classifier.js + BankProfile.js para o backend
// Mantém as mesmas regras usadas na importação manual (OFX/CSV/PDF)
// ─────────────────────────────────────────────────────────────────────────────

// ── Categorias automáticas por palavras-chave ─────────────────────────────────

const AUTO_CATS: Record<string, string[]> = {
  moradia: [
    'aluguel', 'condomin', 'portaria', 'sindico',
    'energia elet', 'conta de luz', 'luz eletrica', 'enel', 'cemig', 'copel', 'cpfl', 'coelba', 'celpe', 'neoenergia', 'eletropaulo', 'light s',
    'energisa',
    'conta de agua', 'agua e esgoto', 'sabesp', 'cedae', 'sanepar', 'embasa', 'cagece',
    'cagepa',
    'gas encanado', 'comgas', 'gas natural', 'ceg ',
    'internet', 'banda larga', 'fibra',
    'claro ', 'vivo ', 'tim ', 'oi ', 'net serv', 'sky ', 'brisanet', 'algar', 'sercomtel',
    'sumicity',
    'iptu', 'seguro resid', 'seguro imovel',
  ],
  alimentacao: [
    'mercado', 'supermercado', 'hipermercado', 'minimercado', 'mercearia',
    'carrefour', 'extra ', 'pao de acucar', 'assai', 'atacadao', 'prezunic', 'mundial ', 'guanabara', 'supernosso', 'superfresko', 'condor', 'muffato', 'angeloni', 'zaffari', 'giassi', 'bistek', 'bahamas', 'epa ', 'fort atacad', 'dia ', 'rede supermer',
    'gbarbosa', 'g.barbosa',
    'bompreco', 'bom preco',
    'bodega',
    'ifood', 'rappi', 'ubereats', 'uber eats', 'james delivery',
    'restaurante', 'lanchonete', 'lancheria', 'padaria', 'panificadora', 'confeitaria', 'doceria', 'sorveteria',
    'acougue', 'peixaria', 'hortifruti', 'quitanda', 'feira livre', 'frutaria',
    'mcdonalds', 'mc donalds', 'burger king', 'burguer king', 'subway', 'pizza', 'pizzaria', 'sushi', 'japones', 'churrascaria', 'hamburguer', 'hamburger', 'burger', 'hot dog', 'crepe', 'tapioca', 'pastelaria', 'pasteis', 'espetinho', 'espeto',
    'bar ', 'boteco', 'botequim', 'cervejaria', 'choperia',
    'acai', 'sorvete', 'gelato',
    'bebida', 'food', 'delivery', 'refeicao',
  ],
  transporte: [
    'uber ', 'uberx', '99pop', '99 taxi', 'cabify', 'taxi', 'corrida',
    'mototaxi',
    'posto ', 'combustivel', 'gasolina', 'etanol', 'diesel', 'alcool combust',
    'shell', 'ipiranga', 'br distribuidora', 'ale combustiveis', 'petrobras dist', 'raizen', 'vibra energia',
    'estacionamento', 'parking', 'zona azul',
    'sem parar', 'conectcar', 'veloe', 'move mais', 'autopass', 'via sul', 'grandespe',
    'pedagio', 'ecovias', 'ecorodovias', 'cart ', 'arteris', 'ccr ', 'autopista',
    'metro ', 'cptm', 'supervia', 'trensurb', 'brt ', 'vlt ', 'trem ',
    'onibus', 'bilhete unico', 'cartao transporte', 'riocard', 'stu ',
    'semob',
    'progresso ',
    'latam', 'gol ', 'azul ', 'passagem aer', 'passagem viag',
    'ipva', 'licenciamento', 'dpvat', 'seguro auto', 'seguro veic',
    'oficina', 'mecanico', 'revisao automovel', 'pneu', 'borracharia', 'autopecas',
  ],
  saude: [
    'farmacia', 'drogaria', 'drogasil', 'droga raia', 'raia ', 'pacheco', 'pague menos', 'ultrafarma', 'onofre', 'nissei', 'panvel', 'brair', 'redepharma', 'rede pharma', 'pharmacia', 'pharma',
    'hospital', 'clinica', 'pronto socorro', 'upa ',
    'hospital de trauma', 'hrt joao pessoa',
    'medico', 'consulta', 'odontologia', 'dentista', 'ortodontia', 'odontologo',
    'laboratorio', 'exame', 'coleta', 'fleury', 'dasa', 'hermes pardini', 'sabin lab',
    'lafe', 'laboratorio farias',
    'unimed', 'amil', 'hapvida', 'prevent', 'bradesco saude', 'sulamerica saude', 'notre dame', 'golden cross',
    'plano de saude', 'plano saude', 'convenio medico',
    'otica', 'oculista', 'lentes de contato',
    'psico', 'terapia', 'psiquiatra', 'fonoaudiologo', 'nutricionista', 'fisioterapia',
    'academia', 'smart fit', 'bluefit', 'bodytech', 'bio ritmo', 'crossfit', 'pilates', 'yoga',
  ],
  educacao: [
    'escola', 'colegio', 'creche', 'periodo integral', 'jardim de infancia',
    'faculdade', 'universidade', 'uni ', 'puc ', 'usp ', 'unifesp', 'insper', 'mackenzie', 'unip ', 'uninove', 'estacio',
    'ufpb', 'uepb', 'ufcg', 'ifpb',
    'unopar',
    'mensalidade escolar', 'matricula', 'semestralidade',
    'curso ', 'treinamento', 'capacitacao',
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
    'fatura cartao', 'fatura nubank', 'fatura inter', 'fatura bradesco',
    'fatura itau', 'fatura santander', 'fatura caixa', 'fatura bb',
    'fatura banco', 'fatura credito', 'fatura visa', 'fatura master',
  ],
}

// ── Perfis por banco (investKw, resgateKw, emContaKw) ────────────────────────

interface BankProfileData {
  investKw: string[]
  resgateKw: string[]
  emContaKw: string[]
}

const BANK_PROFILES: Record<string, BankProfileData> = {
  nubank: {
    investKw: ['aplicacao rdb', 'dinheiro guardado', 'reserva programada', 'rdb', 'cdb nubank', 'tesouro', 'previdencia', 'vgbl', 'pgbl'],
    resgateKw: ['resgate rdb', 'resgate cdb', 'resgate tesouro', 'resgate reserva'],
    emContaKw: ['transferencia recebida pelo pix', 'pix recebido', 'rendimento conta'],
  },
  inter: {
    investKw: ['cdb', 'lci', 'lca', 'tesouro', 'fundo', 'poupanca inter', 'inter invest', 'aplicacao', 'renda fixa', 'b3', 'bov', 'credito b3', 'credito evento b3'],
    resgateKw: ['resgate', 'cdb credito banco inter', 'resgate cdb', 'resgate lci', 'resgate lca', 'resgate fundo'],
    emContaKw: ['pix recebido', 'transferencia recebida'],
  },
  caixa: {
    investKw: ['poupanca', 'fgts', 'cdb caixa', 'lci caixa', 'aplicacao', 'tesouro', 'caderneta'],
    resgateKw: ['resgate poupanca', 'resgate cdb', 'retirada poupanca'],
    emContaKw: [],
  },
  itau: {
    investKw: ['cdb itau', 'lci itau', 'lca itau', 'tesouro', 'fundo itau', 'aplicacao', 'previdencia', 'vgbl', 'pgbl', 'renda fixa', 'iinvest', 'aplicacao automatica'],
    resgateKw: ['resgate cdb', 'resgate lci', 'resgate lca', 'resgate fundo', 'resgate tesouro', 'resgate previdencia', 'resgate aplicacao'],
    emContaKw: ['pix recebido', 'transferencia recebida', 'ted recebido', 'doc recebido'],
  },
  bradesco: {
    investKw: ['cdb bradesco', 'lci bradesco', 'lca bradesco', 'tesouro', 'fundo bradesco', 'aplicacao', 'previdencia', 'vgbl', 'pgbl', 'renda fixa', 'poupanca bradesco', 'agil'],
    resgateKw: ['resgate cdb', 'resgate lci', 'resgate lca', 'resgate fundo', 'resgate tesouro', 'resgate poupanca'],
    emContaKw: ['pix recebido', 'transferencia recebida', 'ted recebido', 'doc recebido'],
  },
  santander: {
    investKw: ['cdb santander', 'lci santander', 'lca santander', 'tesouro', 'fundo santander', 'aplicacao', 'previdencia', 'vgbl', 'pgbl', 'renda fixa', 'poupanca santander', 'select investimento'],
    resgateKw: ['resgate cdb', 'resgate lci', 'resgate lca', 'resgate fundo', 'resgate tesouro', 'resgate poupanca'],
    emContaKw: ['pix recebido', 'transferencia recebida', 'ted recebido', 'doc recebido'],
  },
  bb: {
    investKw: ['cdb bb', 'lci bb', 'lca bb', 'tesouro', 'fundo bb', 'aplicacao', 'previdencia', 'vgbl', 'pgbl', 'poupanca', 'caderneta', 'renda fixa', 'bb renda', 'tesouro direto'],
    resgateKw: ['resgate cdb', 'resgate lci', 'resgate lca', 'resgate fundo', 'resgate tesouro', 'resgate poupanca', 'resgate bb'],
    emContaKw: ['pix recebido', 'transferencia recebida', 'ted recebido', 'doc recebido', 'credito em conta'],
  },
  stone: {
    investKw: ['cdb stone', 'aplicacao', 'renda fixa', 'tesouro'],
    resgateKw: ['resgate cdb', 'resgate stone', 'resgate aplicacao'],
    emContaKw: ['pix recebido', 'transferencia recebida', 'recebimento stone', 'vendas stone'],
  },
  original: {
    investKw: ['cdb original', 'lci original', 'aplicacao', 'renda fixa', 'tesouro', 'fundo original'],
    resgateKw: ['resgate cdb', 'resgate lci', 'resgate original', 'resgate aplicacao'],
    emContaKw: ['pix recebido', 'transferencia recebida', 'ted recebido'],
  },
  generico: {
    investKw: ['aplicac', 'rdb', 'cdb', 'lci', 'lca', 'lft', 'tesouro', 'fundo', 'dinheiro guardado', 'reserva', 'poupanc', 'invest', 'previdencia', 'vgbl', 'pgbl'],
    resgateKw: ['resgate rdb', 'resgate cdb', 'resgate lci', 'resgate lca', 'resgate tesouro', 'resgate fundo', 'resgate poupan'],
    emContaKw: ['transferencia recebida', 'pix recebido', 'rendimento'],
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

function fuzzyNormalize(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b\d{1,2}\/\d{2,4}\b/g, ' ')
    .replace(/\b\d+\b/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function fuzzyMatch(ruleMemo: string, memo: string, threshold = 0.75): boolean {
  const rn = fuzzyNormalize(ruleMemo)
  const mn = fuzzyNormalize(memo)
  if (!rn || !mn) return false
  if (mn.includes(rn) || rn.includes(mn)) return true
  const rTokens = rn.split(' ').filter(t => t.length > 1)
  if (!rTokens.length) return false
  const mWords = new Set(mn.split(' '))
  return rTokens.filter(t => mWords.has(t)).length / rTokens.length >= threshold
}

function normalizeKey(name: string): string {
  let n = normalize(name)
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

function getProfile(bank: string): BankProfileData {
  return BANK_PROFILES[bank] ?? BANK_PROFILES.generico
}

// ── Exports públicos ──────────────────────────────────────────────────────────

export interface ClassifyResult {
  isIncome: boolean
  isResgate: boolean
  isInternal: boolean
  sector: 'gasto' | 'investido' | 'entre_contas'
  category: string | null
}

export const ClassifierService = {
  normalizeKey,

  isResgate(memo: string, isIncome: boolean, bank: string): boolean {
    const profile = getProfile(bank)
    const m = normalize(memo)
    if (profile.resgateKw.some(k => m.includes(k))) return true
    if (isIncome && profile.investKw.some(k => m.includes(k))) return true
    return false
  },

  sector(memo: string, bank: string): 'gasto' | 'investido' | 'em_conta' {
    const profile = getProfile(bank)
    const m = normalize(memo)
    if (profile.investKw.some(k => m.includes(k))) return 'investido'
    if (profile.emContaKw.some(k => m.includes(k))) return 'em_conta'
    return 'gasto'
  },

  isInternalTransfer(memo: string, isOutgoing: boolean, userName: string | null): boolean {
    if (!userName || !isOutgoing) return false
    const m = normalize(memo).toUpperCase()
    const u = normalize(userName).toUpperCase()
    const parts = u.split(/\s+/).filter(p => p.length > 1)
    if (!parts.length) return false
    if (m.includes(u)) return true
    const first = parts[0]
    const last = parts[parts.length - 1]
    if (first !== last && m.includes(first) && m.includes(last)) return true
    const significant = parts.filter(p => p.length >= 3)
    if (significant.length >= 3) {
      const matches = significant.filter(p => m.includes(p))
      if (matches.length >= 3) return true
    }
    return false
  },

  category(
    memo: string,
    amount: number,
    rules: Map<string, string>,
    amountRules: Map<string, string>,
  ): string {
    const m = normalize(memo)
    // 1. Regra por valor exato
    const amountKey = `${normalizeKey(memo)}::${Number(amount).toFixed(2)}`
    if (amountRules.has(amountKey)) return amountRules.get(amountKey)!
    // 2. Regra por memo
    if (rules.has(m)) return rules.get(m)!
    // 2b. Fuzzy match — tolera variações leves como sufixos de data
    for (const [ruleMemo, cat] of rules.entries()) {
      if (fuzzyMatch(ruleMemo, m)) return cat
    }
    // 3. Palavras-chave automáticas
    for (const [cat, keywords] of Object.entries(AUTO_CATS)) {
      if (keywords.some(k => m.includes(k))) return cat
    }
    return 'outros'
  },

  classify(
    memo: string,
    isIncome: boolean,
    amount: number,
    bank: string,
    userName: string | null,
    rules: Map<string, string>,
    amountRules: Map<string, string>,
  ): ClassifyResult {
    const resgate = this.isResgate(memo, isIncome, bank)
    const internal = !isIncome && !resgate && this.isInternalTransfer(memo, true, userName)

    let sector: 'gasto' | 'investido' | 'entre_contas'
    if (resgate) sector = 'investido'
    else if (internal) sector = 'entre_contas'
    else if (!isIncome) sector = this.sector(memo, bank) as 'gasto' | 'investido' | 'entre_contas'
    else sector = 'gasto'

    const shouldCategorize = !isIncome && !resgate && !internal && sector === 'gasto'
    const category = shouldCategorize ? this.category(memo, amount, rules, amountRules) : null

    return {
      isIncome: isIncome && !resgate,
      isResgate: resgate,
      isInternal: internal,
      sector,
      category,
    }
  },
}
