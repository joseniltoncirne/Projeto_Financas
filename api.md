# O Orientador — Documentação da API e Estado Atual do Projeto

> Última atualização: 2026-05-22

---

## Visão Geral

**O Orientador** é uma aplicação web de finanças pessoais com:

- **Frontend:** SPA Vanilla JS + Vite (sem framework)
- **Backend:** Fastify 4 + TypeScript + Prisma ORM + SQLite
- **Autenticação:** JWT (access 15min + refresh 7d) com hash bcrypt
- **Integração bancária:** Pluggy.ai (Open Finance Brasil)

O usuário conecta seus bancos via Pluggy e as transações são sincronizadas automaticamente ao fazer login. Importação manual por arquivo `.CSV`, `.OFX` ou `.PDF` permanece disponível como alternativa.

---

## Stack Técnica

| Camada | Tecnologia |
|---|---|
| Frontend runtime | Vite + Vanilla JS (sem bundler de módulos em produção) |
| Backend runtime | Node.js 20 LTS |
| Framework HTTP | Fastify 4 |
| Linguagem backend | TypeScript 5 |
| ORM | Prisma 5 |
| Banco de dados | SQLite (`backend/prisma/dev.db`) |
| Autenticação | JWT via `@fastify/jwt` |
| Hash de senha | bcryptjs (cost 12) |
| Validação | Zod |
| Integração bancária | Pluggy.ai (Open Finance Brasil) |
| Segurança | `@fastify/helmet`, `@fastify/rate-limit`, `@fastify/cors` |
| Logging | Pino (via Fastify), formato pino-pretty em dev |

---

## Estrutura de Pastas

```
Projeto_Financas/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Fonte da verdade do banco
│   │   ├── dev.db                 # Banco SQLite (não commitado)
│   │   └── migrations/
│   │       ├── 20260520204156_init/
│   │       └── 20260522085049_pluggy/   # ← nova: BankConnection + externalId
│   └── src/
│       ├── server.ts              # Entrypoint
│       ├── app.ts                 # Factory Fastify (registra plugins e rotas)
│       ├── config.ts              # Validação de .env com Zod
│       ├── routes/
│       │   ├── auth.ts            # /auth/*
│       │   ├── incomes.ts         # /api/incomes
│       │   ├── expenses.ts        # /api/expenses
│       │   ├── balances.ts        # /api/balances
│       │   ├── rules.ts           # /api/rules e /api/amount-rules
│       │   ├── categories.ts      # /api/categories
│       │   ├── aliases.ts         # /api/aliases
│       │   ├── import.ts          # /api/import
│       │   ├── banks.ts           # /api/banks
│       │   ├── connections.ts     # /api/connections  ← novo (Pluggy)
│       │   └── webhooks.ts        # /webhooks/pluggy  ← novo (Pluggy)
│       ├── services/
│       │   ├── auth.service.ts
│       │   ├── import.service.ts  # bulkImport + bulkImportExternal
│       │   ├── pluggy.service.ts  # ← novo: wrapper da API Pluggy
│       │   └── sync.service.ts    # ← novo: orquestrador do sync bancário
│       ├── repositories/
│       │   ├── user.repository.ts
│       │   ├── income.repository.ts
│       │   ├── expense.repository.ts
│       │   ├── balance.repository.ts
│       │   ├── rule.repository.ts
│       │   ├── category.repository.ts
│       │   ├── alias.repository.ts
│       │   ├── connection.repository.ts  ← novo (Pluggy)
│       │   └── refreshToken.repository.ts
│       ├── schemas/
│       │   ├── auth.schema.ts
│       │   ├── expense.schema.ts
│       │   ├── import.schema.ts
│       │   └── connection.schema.ts  ← novo (Pluggy)
│       └── middleware/
│           ├── auth.middleware.ts
│           └── error.middleware.ts
├── src/
│   ├── main.js
│   ├── app.js                     # Classe FinanceApp (core)
│   ├── constants.js
│   └── js/
│       ├── services/
│       │   ├── ApiClient.js       # fetch wrapper com JWT auto-refresh
│       │   ├── AuthService.js     # login, register, validação de CPF
│       │   ├── DataStore.js       # cache em memória + sync com API
│       │   └── ImportService.js   # parse de OFX, CSV, PDF
│       ├── ui/
│       │   ├── AuthUI.js          # Tela de login/register
│       │   ├── Renderer.js        # Renderização de tabelas e gráficos
│       │   ├── CategoryDetailUI.js
│       │   ├── CategoryManagerUI.js
│       │   ├── ImportUI.js        # Modal de importação manual
│       │   └── BankConnectionUI.js  ← novo: Pluggy Connect Widget
│       └── utils/
│           ├── BankDetector.js
│           ├── BankProfile.js
│           └── Classifier.js
├── index.html
├── api.md                         ← este arquivo
├── .gitignore
└── vite.config.js
```

---

## Variáveis de Ambiente (`backend/.env`)

```env
# Banco de dados
DATABASE_URL="file:./dev.db"

# JWT
JWT_SECRET="minimo-32-caracteres-aqui"
JWT_ACCESS_EXPIRES="15m"
JWT_REFRESH_EXPIRES="7d"

# Servidor
PORT=3333
HOST=0.0.0.0
NODE_ENV=development

# CORS
ALLOWED_ORIGIN="http://localhost:5173"

# Pluggy (Open Finance) — obter em pluggy.ai
PLUGGY_CLIENT_ID="seu-client-id"
PLUGGY_CLIENT_SECRET="seu-client-secret"
```

---

## Schema do Banco de Dados

```
User
 ├── id, name, cpf (único), passwordHash, createdAt
 ├── → Income[]
 ├── → Expense[]
 ├── → Balance[]
 ├── → Rule[]
 ├── → AmountRule[]
 ├── → Category[]
 ├── → Alias[]
 ├── → RefreshToken[]
 └── → BankConnection[]   ← novo

Income
 ├── id, userId, month (YYYY-MM), name, amount, bank
 ├── dateStr (DD/MM/YYYY)
 └── externalId?           ← novo (ID Pluggy, para deduplicação)

Expense
 ├── id, userId, month, name, amount, bank
 ├── type (fixo | variavel), category?, sector (gasto | investido | entre_contas)
 ├── isResgate, isInternal, dateStr
 └── externalId?           ← novo (ID Pluggy, para deduplicação)

Balance       — { userId, month, bank } único → value
Rule          — { userId, memo } → category
AmountRule    — { userId, normalizedName, amount } → category
Category      — { userId, key } → label, color?
Alias         — { userId, normalizedName } → alias
RefreshToken  — token único, expiresAt

BankConnection  ← novo
 ├── id, userId
 ├── itemId (único) — ID do item no Pluggy
 ├── bank           — "nubank" | "inter" | "caixa" | etc.
 ├── status         — "ok" | "syncing" | "error"
 └── lastSync?      — última sincronização bem-sucedida
```

---

## Endpoints da API

Todas as rotas `/api/*` exigem header `Authorization: Bearer <accessToken>`.

### Autenticação — `/auth`

| Método | Rota | Body | Resposta |
|---|---|---|---|
| `POST` | `/auth/register` | `{ name, cpf, password }` | `201 { user, accessToken, refreshToken }` |
| `POST` | `/auth/login` | `{ cpf, password }` | `200 { user, accessToken, refreshToken }` |
| `POST` | `/auth/refresh` | `{ refreshToken }` | `200 { accessToken, refreshToken }` |
| `DELETE` | `/auth/logout` | `{ refreshToken }` | `204` |

Regras: rate limit 10 req/min; senha mínimo 6 chars; CPF validado com dígitos verificadores.

---

### Receitas — `/api/incomes`

| Método | Rota | Params | Resposta |
|---|---|---|---|
| `GET` | `/api/incomes` | `?month=YYYY-MM&bank=` | `200 Income[]` |
| `POST` | `/api/incomes` | `{ month, name, amount, bank, dateStr? }` | `201 Income` |
| `DELETE` | `/api/incomes/:id` | — | `204` |
| `DELETE` | `/api/incomes` | `?month=&bank=` | `204` bulk |

---

### Despesas — `/api/expenses`

| Método | Rota | Params | Resposta |
|---|---|---|---|
| `GET` | `/api/expenses` | `?month=&bank=&sector=` | `200 Expense[]` |
| `POST` | `/api/expenses` | `{ month, name, amount, type, category, sector, bank, dateStr?, isResgate?, isInternal? }` | `201 Expense` |
| `PATCH` | `/api/expenses/:id` | `{ category?, sector?, type? }` | `200 Expense` |
| `DELETE` | `/api/expenses/:id` | — | `204` |
| `DELETE` | `/api/expenses` | `?month=&bank=` | `204` bulk |

---

### Saldos — `/api/balances`

| Método | Rota | Params | Resposta |
|---|---|---|---|
| `GET` | `/api/balances` | `?month=YYYY-MM` | `200 Balance[]` |
| `PUT` | `/api/balances` | `{ month, bank, value }` | `200 Balance` (upsert) |

---

### Regras de Categorização — `/api/rules`

| Método | Rota | Params | Resposta |
|---|---|---|---|
| `GET` | `/api/rules` | — | `200 Rule[]` |
| `PUT` | `/api/rules` | `{ memo, category }` | `200 Rule` (upsert) |
| `GET` | `/api/amount-rules` | — | `200 AmountRule[]` |
| `PUT` | `/api/amount-rules` | `{ normalizedName, amount, category }` | `200 AmountRule` (upsert) |
| `DELETE` | `/api/amount-rules` | `?normalizedName=&amount=` | `204` |

---

### Categorias Customizadas — `/api/categories`

| Método | Rota | Params | Resposta |
|---|---|---|---|
| `GET` | `/api/categories` | — | `200 Category[]` |
| `POST` | `/api/categories` | `{ key, label, color? }` | `201 Category` |
| `PATCH` | `/api/categories/:key` | `{ label?, color? }` | `200 Category` |
| `DELETE` | `/api/categories/:key` | — | `204` |

---

### Apelidos — `/api/aliases`

| Método | Rota | Params | Resposta |
|---|---|---|---|
| `GET` | `/api/aliases` | — | `200 Alias[]` |
| `PUT` | `/api/aliases` | `{ normalizedName, alias }` | `200 Alias` (upsert) |
| `DELETE` | `/api/aliases` | `?normalizedName=` | `204` |

Apelidos permitem exibir um nome personalizado para um comerciante (ex: "IFOOD*XYZ123" → "iFood").

---

### Importação em Lote — `/api/import`

| Método | Rota | Body | Resposta |
|---|---|---|---|
| `POST` | `/api/import` | `{ transactions[], bank, saldoFinal?, saldoMonth? }` | `201 { imported: number }` |

O parse do arquivo (PDF/CSV/OFX) acontece **no frontend**. Apenas o resultado parseado é enviado ao servidor.

---

### Bancos com Dados — `/api/banks`

| Método | Rota | Resposta |
|---|---|---|
| `GET` | `/api/banks` | `200 string[]` — bancos com pelo menos uma transação |

Ordem: nubank → inter → caixa → itau → bradesco → santander → bb → stone → original → generico.

---

### Conexões Bancárias (Pluggy) — `/api/connections` ← novo

| Método | Rota | Body/Params | Resposta |
|---|---|---|---|
| `GET` | `/api/connections` | — | `200 BankConnection[]` |
| `POST` | `/api/connections/token` | — | `200 { connectToken }` |
| `POST` | `/api/connections` | `{ itemId, connectorName? }` | `201 BankConnection` |
| `POST` | `/api/connections/:itemId/sync` | — | `200 { ...conn, synced: number }` |
| `DELETE` | `/api/connections/:itemId` | — | `204` |

**Fluxo:**
1. Frontend chama `POST /token` → recebe `connectToken`
2. Frontend abre o widget `PluggyConnect` com o token
3. Usuário autentica no banco dentro do widget
4. Widget retorna `itemId` ao frontend
5. Frontend chama `POST /connections` com o `itemId`
6. Backend detecta o banco, salva a conexão e dispara o sync inicial em background
7. Sync subsequentes: automático via webhook ou manual via `POST .../sync`

---

### Webhook Pluggy — `/webhooks/pluggy` ← novo

| Método | Rota | Body | Resposta |
|---|---|---|---|
| `POST` | `/webhooks/pluggy` | `{ event: "item/updated", itemId }` | `200 { ok: true }` |

O backend responde `200` imediatamente (requisito Pluggy ≤ 30s) e processa o sync de forma assíncrona. Configurar a URL do webhook no dashboard Pluggy apontando para `https://seu-dominio/webhooks/pluggy`.

---

## Fluxo de Sincronização Pluggy

```
SyncService.syncItem(userId, itemId)
    │
    ├─ 1. Atualiza status = 'syncing'
    ├─ 2. PluggyService.getAccounts(itemId)  → contas do tipo BANK
    ├─ 3. Para cada conta:
    │      PluggyService.getTransactions(accountId, from, to)
    │      from = lastSync ?? (hoje - 90 dias)
    │
    ├─ 4. SyncService.mapTransaction(t, bank) para cada transação:
    │      ├─ amount = Math.abs(t.amount)
    │      ├─ isIncome = t.type === 'CREDIT'
    │      ├─ month = t.date.slice(0, 7)   // "YYYY-MM"
    │      ├─ dateStr = "DD/MM/YYYY"
    │      ├─ sector = 'entre_contas' se parecer transferência interna
    │      └─ externalId = t.id            // ID único do Pluggy
    │
    ├─ 5. importService.bulkImportExternal(userId, mapped, bank)
    │      ├─ Busca externalIds já existentes no banco
    │      ├─ Filtra duplicatas (dedup idempotente)
    │      ├─ Aplica regras do usuário (Rule + AmountRule) para categorizar
    │      └─ Cria registros Income/Expense com externalId
    │
    └─ 6. Atualiza lastSync = now(), status = 'ok'
```

---

## Arquitetura Frontend

O frontend é uma SPA sem ES modules (scripts carregados sequencialmente via `<script>`). A classe `FinanceApp` é definida em `app.js` e seus métodos são adicionados via `Object.assign(FinanceApp.prototype, {...})` nos arquivos de UI.

**Ordem de carregamento dos scripts:**
```
constants.js → ApiClient.js → AuthService.js → AuthUI.js
→ DataStore.js → BankDetector.js → BankProfile.js
→ Classifier.js → ImportService.js → Renderer.js
→ app.js (define FinanceApp) → CategoryDetailUI.js
→ CategoryManagerUI.js → ImportUI.js → BankConnectionUI.js
→ main.js
```

**Camada de dados (`DataStore.js`):**
- Cache em memória carregado no login via `_loadAll()`
- Leituras síncronas do cache (sem aguardar API)
- Escritas assíncronas: chama API e atualiza cache local
- Após importação ou sync: `_loadAll()` recarrega tudo

**Principais módulos frontend:**

| Arquivo | Responsabilidade |
|---|---|
| `ApiClient.js` | `fetch` com JWT no header; auto-refresh do token expirado |
| `AuthService.js` | Validação de CPF, register, login, logout |
| `DataStore.js` | Cache + CRUD completo via API |
| `ImportService.js` | Parse de OFX, CSV e PDF (lógica client-side) |
| `Classifier.js` | Detecta tipo (renda/gasto/resgate/interno), aplica regras |
| `Renderer.js` | Gera HTML de tabelas, cards, gráficos |
| `BankConnectionUI.js` | Widget Pluggy, lista de conexões, sync manual |
| `ImportUI.js` | Modal de revisão de importação manual |
| `CategoryDetailUI.js` | Drill-down de categorias, apelidos |
| `CategoryManagerUI.js` | Criar/renomear/deletar categorias e apelidos |

---

## Como Rodar

```bash
# 1. Instalar dependências do backend
cd backend && npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com JWT_SECRET, PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET

# 3. Aplicar migrações do banco
npx prisma migrate deploy
npx prisma generate

# 4. Iniciar o backend (porta 3333)
npm run dev

# 5. Em outro terminal — iniciar o frontend (porta 5173)
cd .. && npm run dev
```

---

## Credenciais Pluggy (Sandbox)

1. Criar conta gratuita em [pluggy.ai](https://pluggy.ai)
2. Dashboard → **Settings → API Keys**
3. Copiar `CLIENT_ID` e `CLIENT_SECRET` do ambiente **sandbox**
4. Colar em `backend/.env`
5. No app, usar o banco de teste **"Pluggy Bank"** com as credenciais fictícias fornecidas pelo dashboard

Para produção, trocar para as credenciais do ambiente **production** e configurar o webhook:
`POST https://seu-dominio/webhooks/pluggy`

---

## Segurança

- **Helmet:** headers `X-Content-Type-Options`, `X-Frame-Options`, `CSP`
- **Rate limiting:** 10 req/min em `/auth`; 200 req/min nas demais
- **CORS:** apenas `ALLOWED_ORIGIN` configurada no `.env`
- **JWT stateless** com refresh token rotativo (invalida o anterior a cada uso)
- **bcrypt cost 12** — senhas nunca armazenadas em texto plano
- **Prisma** — queries parametrizadas, sem risco de SQL injection
- **Isolamento por usuário** — todas as queries filtram por `userId`; nenhum dado cruza entre usuários

---

## Alterações Recentes (2026-05-22)

### Integração Pluggy — Sync Automático Bancário
- Novo modelo `BankConnection` no banco (itemId Pluggy, banco, status, lastSync)
- Campo `externalId` adicionado em `Income` e `Expense` para deduplicação idempotente
- `pluggy.service.ts` — wrapper da API Pluggy com cache do `apiKey` (renovado a cada 110min)
- `sync.service.ts` — orquestra fetch → transformação → dedup → save; aplica regras de categorização automaticamente
- `import.service.ts` — novo método `bulkImportExternal`
- Rotas `/api/connections` (CRUD + sync) e `/webhooks/pluggy`
- Frontend: `BankConnectionUI.js` com widget Pluggy Connect, lista de bancos, sync manual e desconectar
- Dropzone substituído por seção dual-mode: "Conectar banco" (automático) + importação de arquivo (fallback)
- CSS: novos estilos para `.bank-connect-section`, `.connection-item`, `.dropzone-compact`, `.import-divider`

### Refatoração de app.js (sessão anterior)
- `app.js` (436 linhas) dividido em 4 módulos:
  - `CategoryDetailUI.js` — drill-down de categorias com factory `_mkCategoryDetailHelpers`
  - `CategoryManagerUI.js` — gerenciamento de categorias e apelidos
  - `ImportUI.js` — modal de importação manual
- Todos os `alert()` / `confirm()` / `prompt()` nativos substituídos por modais HTML customizados
- `_showInputModal()`, `_showConfirmModal()` retornam `Promise` (compatíveis com `await`)
- `_setLoading()` — overlay com spinner para operações longas
- `_showToast()` — notificações não-bloqueantes (success, info, error)
