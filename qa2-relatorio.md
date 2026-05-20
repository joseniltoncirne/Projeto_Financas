# QA2 — Relatório de Análise Sênior

**Data:** 2026-05-19  
**Escopo:** Revisão completa do código-fonte após ciclo de features (classificação por palavras-chave, categorias customizadas, regras de usuário, modais de detalhe, redesign do overview, emojis de categoria, reordenação do layout)

---

## Sumário Executivo

O projeto está funcional e bem estruturado para uma SPA vanilla. A separação em camadas (DataStore / Classifier / Renderer / app.js) é coerente. Existem, porém, **dois problemas de segurança críticos** para o cenário de produto comercial e **três bugs de comportamento** que precisam ser corrigidos antes de qualquer lançamento público.

---

## 🔴 Crítico

### C1 — Performance: leitura de localStorage por transação na importação

**Arquivo:** `src/js/utils/Classifier.js:76` e `src/js/services/DataStore.js:54`

`Classifier.category()` chama `DataStore.getRules()`, que chama `DataStore.load()` a cada invocação. `DataStore.load()` faz `localStorage.getItem` + `JSON.parse` toda vez.

Para um extrato com 200 transações, isso gera **200 leituras + 200 deserializações JSON** durante `importPending.map(...)`.

**Correção sugerida:**
```javascript
// Classifier.js — cachear as regras durante a sessão de classificação
static categoryBatch(memos) {
    const rules = DataStore.getRules() // lê UMA vez
    return memos.map(m => this._categoryWithRules(m, rules))
}

static category(memo) {
    return this._categoryWithRules(memo, DataStore.getRules())
}

static _categoryWithRules(memo, rules) {
    const m = memo.toLowerCase()
    if (rules[m]) return rules[m]
    for (const [cat, keywords] of Object.entries(this.AUTO_CATS)) {
        if (keywords.some(k => m.includes(k))) return cat
    }
    return 'outros'
}
```

---

### C2 — Bug multi-usuário: categorias customizadas vazam entre sessões

**Arquivo:** `src/js/app.js` — `_syncCustomCategories()`

```javascript
_syncCustomCategories() {
    const custom = DataStore.getCustomCategories()
    for (const [key, cat] of Object.entries(custom)) {
        CAT_LABELS[key] = cat.label   // ADICIONA, nunca limpa
        CAT_COLORS[key] = cat.color
    }
}
```

`CAT_LABELS` e `CAT_COLORS` são objetos globais (`var`) que persistem enquanto a página estiver aberta. Se o usuário A fizer login, criar categorias customizadas, e depois o usuário B fizer login **sem recarregar a página** (via tela de login da SPA), as categorias de A continuam visíveis em `CAT_LABELS`/`CAT_COLORS` para B.

**Correção:** No logout (ou no `init()` antes de carregar), redefinir os globais para os valores base:

```javascript
_syncCustomCategories() {
    // Resetar para os valores originais de constants.js
    const BASE_LABELS = { moradia: '🏠 Moradia', alimentacao: '🍽️ Alimentação', /* ... */ }
    const BASE_COLORS = { moradia: '#2e7fd8', /* ... */ }
    Object.keys(CAT_LABELS).forEach(k => { if (!BASE_LABELS[k]) delete CAT_LABELS[k] })
    Object.assign(CAT_LABELS, BASE_LABELS)
    Object.keys(CAT_COLORS).forEach(k => { if (!BASE_COLORS[k]) delete CAT_COLORS[k] })
    Object.assign(CAT_COLORS, BASE_COLORS)
    // Aplicar customizações do usuário atual
    const custom = DataStore.getCustomCategories()
    for (const [key, cat] of Object.entries(custom)) {
        CAT_LABELS[key] = cat.label
        CAT_COLORS[key] = cat.color
    }
}
```

Alternativamente, exportar `BASE_CAT_LABELS` e `BASE_CAT_COLORS` como `const` frozen em `constants.js` e usar como referência.

---

## 🟠 Alto

### A1 — Segurança: validação de CPF incompleta

**Arquivo:** `src/js/constants.js` — `AuthService.validateCPF()`

A validação atual apenas verifica se a string tem 11 dígitos. CPFs inválidos como `00000000000`, `11111111111`, `12345678901` passam na validação.

**Impacto comercial:** Usuário pode criar conta com CPF falso e potencialmente colidir com o namespace de outro usuário.

**Correção:** Implementar verificação dos dois dígitos verificadores (algoritmo padrão da Receita Federal):

```javascript
static validateCPF(cpf) {
    const d = cpf.replace(/\D/g, '')
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
    let sum = 0
    for (let i = 0; i < 9; i++) sum += +d[i] * (10 - i)
    let r = (sum * 10) % 11
    if (r === 10 || r === 11) r = 0
    if (r !== +d[9]) return false
    sum = 0
    for (let i = 0; i < 10; i++) sum += +d[i] * (11 - i)
    r = (sum * 10) % 11
    if (r === 10 || r === 11) r = 0
    return r === +d[10]
}
```

---

### A2 — Segurança: ausência de autenticação real

**Arquivo:** `src/js/constants.js` — `AuthService`

O login requer apenas o CPF. Qualquer pessoa com o CPF de outra pessoa acessa todos os dados financeiros dela. Não há senha, token, nem nenhuma forma de verificação de identidade.

**Risco:** Inaceitável para produto comercial com dados financeiros sensíveis.

**Recomendação:**
- Curto prazo: adicionar senha com hash (ex: SHA-256 via `crypto.subtle.digest`) armazenado no localStorage — não é segurança real, mas impede acesso trivial
- Médio prazo: migrar para backend com autenticação JWT (o código já tem comentários "futuramente → API REST" indicando que isso foi planejado)

---

### A3 — Nome enganoso: `getAllMonthsWithData()` não filtra por dados reais

**Arquivo:** `src/js/services/DataStore.js:161`

```javascript
static getAllMonthsWithData() {
    // Sempre retorna os últimos 6 meses — independente de haver dados
    const months = []
    // ...
    return months
}
```

O nome sugere que retorna apenas meses que têm dados, mas na realidade retorna os últimos 6 meses fixos. Nenhum caller atual depende do filtro, mas o nome é uma armadilha para manutenção futura.

**Correção:** Renomear para `getRecentMonths()` ou implementar o filtro real:

```javascript
static getMonthsWithData() {
    const data = this.load()
    const months = new Set()
    data.incomes.forEach(i => { if (i.month) months.add(i.month) })
    data.expenses.forEach(e => { if (e.month) months.add(e.month) })
    return [...months].sort()
}
```

---

## 🟡 Médio

### M1 — Transações com valor zero ignoradas silenciosamente

**Arquivo:** `src/js/services/ImportService.js` — `flush()` interno de `_parsePDFLines()`

```javascript
if (amount <= 0) { memo = ''; return }  // ou equivalente
```

Transações de saldo zero (IOF, ajustes, estornos parciais) são descartadas sem aviso ao usuário. Em extratos reais isso pode causar divergência entre o total do extrato e o total importado.

**Recomendação:** Importar com `amount === 0` e exibir na tela de revisão com flag visual, deixando o usuário decidir se quer incluir.

---

### M2 — Detecção de banco frágil por palavras-chave estreitas

**Arquivo:** `src/js/services/BankDetector.js` — `fromPDFLines()`

A detecção depende de strings específicas que podem variar entre versões de PDF geradas pelo mesmo banco. Uma mudança de layout no app do Nubank ou Caixa pode fazer com que nenhum banco seja detectado e o sistema caia para `generico`, alterando as regras de setor para todas as transações.

**Recomendação:**
- Adicionar testes unitários para os PDFs de cada banco (arquivos de fixture anonimizados)
- Considerar detecção por múltiplos critérios com score (não apenas o primeiro match)
- Logar quando o fallback para `generico` for usado para facilitar diagnóstico

---

### M3 — `mkDonutSection` com 8 parâmetros posicionais

**Arquivo:** `src/js/ui/Renderer.js` — `mkDonutSection(...)`

Funções com muitos parâmetros posicionais são propensas a erros de ordem silenciosos. Uma chamada com `accentColor` e `bgColor` trocados compila sem erro mas produz visual incorreto.

**Correção:** Converter para objeto de opções:

```javascript
mkDonutSection({ id, items, valueKey, title, accentColor, bgColor, borderColor, emptyMsg }) { ... }
```

---

## 🟢 Positivo — O que está bem feito

| Aspecto | Detalhe |
|---|---|
| Geração de IDs | `crypto.randomUUID()` com fallback para `Date.now() + Math.random()` — colisões praticamente impossíveis |
| Prevenção de XSS | `Renderer.esc()` aplicado em todos os dados de usuário interpolados no HTML |
| Integridade dos dados | `DataStore._normalize()` garante estrutura correta mesmo com localStorage corrompido |
| Proteção de quota | `QuotaExceededError` tratado com mensagem amigável em `DataStore.save()` |
| Destruição de charts | Instâncias Chart.js destruídas antes de recriar, evitando memory leak e warnings do Canvas |
| Regras de usuário | `DataStore.rules` com prioridade sobre `AUTO_CATS` — arquitetura correta para aprendizado |
| Bulk re-categorização | Feita em um único ciclo load/save — eficiente e atômico |
| Separação de camadas | DataStore (persistência) / Classifier (lógica) / Renderer (apresentação) / app.js (orquestração) — clara e mantível |
| Fallback de categoria | `outros` como default garante que nenhuma transação fique sem categoria |

---

## Priorização para Produto Comercial

| Prioridade | Item | Esforço estimado |
|---|---|---|
| 1 | A2 — Adicionar senha ao login | 2h |
| 2 | A1 — Validação real de CPF | 30min |
| 3 | C2 — Reset de globais no login/logout | 1h |
| 4 | C1 — Cache de rules na importação | 1h |
| 5 | A3 — Renomear `getAllMonthsWithData` | 15min |
| 6 | M1 — Transações zero não ignoradas | 2h |
| 7 | M2 — Testes de detecção de banco | 3h |
| 8 | M3 — Refatorar `mkDonutSection` | 30min |
