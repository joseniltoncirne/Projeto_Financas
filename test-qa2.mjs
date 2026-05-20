/**
 * QA2 — Teste automatizado das correções
 * Executa: node test-qa2.mjs
 */

import { chromium } from 'playwright-core'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = 'http://localhost:5173'
const SHOTS = path.join(__dirname, 'qa2-screenshots')

import fs from 'fs'
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS)

const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false })
const wait = ms => new Promise(r => setTimeout(r, ms))

let passed = 0, failed = 0
const results = []

function log(label, ok, detail = '') {
    const icon = ok ? '✅' : '❌'
    console.log(`${icon} ${label}${detail ? ' — ' + detail : ''}`)
    results.push({ label, ok, detail })
    if (ok) passed++; else failed++
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function freshPage(browser) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await ctx.newPage()
    // Limpa localStorage para garantir estado fresco
    await page.goto(BASE)
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await wait(400)
    return page
}

async function register(page, name, cpf, pw, pw2 = pw) {
    await page.click('#tab-register')
    await wait(200)
    await page.fill('#auth-name', name)
    await page.fill('#auth-cpf', cpf)
    await page.fill('#auth-pw', pw)
    await page.fill('#auth-pw2', pw2)
    await page.click('.auth-btn')
    await wait(600)
}

async function login(page, cpf, pw) {
    await page.click('#tab-login')
    await wait(200)
    await page.fill('#auth-cpf', cpf)
    await page.fill('#auth-pw', pw)
    await page.click('.auth-btn')
    await wait(600)
}

// ── Tests ──────────────────────────────────────────────────────────────────────

const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: false,
    slowMo: 80,
})

// ══════════════════════════════════════════════════════════════════════════════
// TESTE 1 — A2: Tela de cadastro exibe campos de senha
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n── Teste 1: Campos de senha no cadastro ──')
{
    const page = await freshPage(browser)
    await page.click('#tab-register')
    await wait(300)
    await shot(page, '01-cadastro-campos-senha')

    const hasPw = await page.$('#auth-pw')
    const hasPw2 = await page.$('#auth-pw2')
    log('Campos senha + confirmar visíveis no cadastro', !!(hasPw && hasPw2))
    await page.close()
}

// ══════════════════════════════════════════════════════════════════════════════
// TESTE 2 — A2: Validação de senhas diferentes
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n── Teste 2: Senhas diferentes rejeitadas ──')
{
    const page = await freshPage(browser)
    await register(page, 'João Silva', '529.982.247-25', 'senha123', 'diferente')
    await shot(page, '02-cadastro-senhas-divergem')
    const errorEl = await page.$('#auth-error .auth-error')
    const errorText = errorEl ? await errorEl.textContent() : ''
    log('Senhas diferentes gera erro', errorText.includes('não coincidem'))
    await page.close()
}

// ══════════════════════════════════════════════════════════════════════════════
// TESTE 3 — A1: CPF inválido rejeitado
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n── Teste 3: CPF inválido rejeitado ──')
{
    const page = await freshPage(browser)
    await register(page, 'João Silva', '000.000.000-00', 'senha123')
    await shot(page, '03-cpf-invalido-rejeitado')
    const errorEl = await page.$('#auth-error .auth-error')
    const errorText = errorEl ? await errorEl.textContent() : ''
    log('CPF 000.000.000-00 rejeitado', errorText.toLowerCase().includes('inválido') || errorText.toLowerCase().includes('invalido'))
    await page.close()
}

// ══════════════════════════════════════════════════════════════════════════════
// TESTE 4 — A1 + A2: Cadastro com CPF válido e senha funciona
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n── Teste 4: Cadastro com CPF válido + senha ──')
{
    const page = await freshPage(browser)
    // CPF gerado pelo algoritmo padrão: 529.982.247-25
    await register(page, 'João Silva Souza', '529.982.247-25', 'senha123')
    await shot(page, '04-cadastro-sucesso')
    const header = await page.$('#app-header')
    const headerVisible = header ? await header.isVisible() : false
    log('Cadastro com CPF válido + senha concluído', headerVisible)
    await page.close()
}

// ══════════════════════════════════════════════════════════════════════════════
// TESTE 5 — A2: Login com senha errada rejeitado
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n── Teste 5: Login com senha errada ──')
{
    const page = await freshPage(browser)
    await register(page, 'João Silva Souza', '529.982.247-25', 'senha123')
    await page.evaluate(() => { localStorage.removeItem('mf_session') })
    await page.reload()
    await wait(400)
    await login(page, '529.982.247-25', 'errada99')
    await shot(page, '05-login-senha-errada')
    const errorEl = await page.$('#auth-error .auth-error')
    const errorText = errorEl ? await errorEl.textContent() : ''
    log('Senha errada rejeitada', errorText.toLowerCase().includes('incorreta'))
    await page.close()
}

// ══════════════════════════════════════════════════════════════════════════════
// TESTE 6 — A2: Login com senha correta entra
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n── Teste 6: Login com senha correta ──')
{
    const page = await freshPage(browser)
    await register(page, 'João Silva Souza', '529.982.247-25', 'senha123')
    await page.evaluate(() => { localStorage.removeItem('mf_session') })
    await page.reload()
    await wait(400)
    await login(page, '529.982.247-25', 'senha123')
    await shot(page, '06-login-senha-correta')
    const header = await page.$('#app-header')
    const headerVisible = header ? await header.isVisible() : false
    log('Login com senha correta entra no app', headerVisible)
    await page.close()
}

// ══════════════════════════════════════════════════════════════════════════════
// TESTE 7 — A2: Senha curta (<6) rejeitada no cadastro
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n── Teste 7: Senha curta rejeitada ──')
{
    const page = await freshPage(browser)
    await register(page, 'João Silva Souza', '529.982.247-25', '12345', '12345')
    await shot(page, '07-senha-curta-rejeitada')
    const errorEl = await page.$('#auth-error .auth-error')
    const errorText = errorEl ? await errorEl.textContent() : ''
    log('Senha < 6 chars rejeitada', errorText.includes('6 caracteres'))
    await page.close()
}

// ══════════════════════════════════════════════════════════════════════════════
// TESTE 8 — C2: Categorias customizadas não vazam entre usuários
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n── Teste 8: Categorias não vazam entre usuários ──')
{
    const page = await freshPage(browser)
    // Usuário A cria conta e adiciona categoria customizada via localStorage direto
    await register(page, 'Usuário Alpha Teste', '529.982.247-25', 'senha123')
    await wait(300)
    // Injeta categoria customizada para usuário A no localStorage
    await page.evaluate(() => {
        const key = `mf_data_52998224725`
        const data = JSON.parse(localStorage.getItem(key) || '{}')
        if (!data.categories) data.categories = {}
        data.categories['minha_cat'] = { label: 'Minha Cat Exclusiva', color: '#ff0000' }
        localStorage.setItem(key, JSON.stringify(data))
    })
    // Logout sem reload (simula troca de usuário dentro da mesma página)
    await page.evaluate(() => { localStorage.removeItem('mf_session') })
    await page.reload()
    await wait(400)

    // Usuário B cadastra
    await register(page, 'Usuario Beta Silva', '111.444.777-35', 'senha456')
    await wait(400)
    await shot(page, '08-categorias-nao-vazam')

    // Verifica se "Minha Cat Exclusiva" NÃO aparece nos globals do usuário B
    const leaked = await page.evaluate(() => {
        return Object.keys(CAT_LABELS).includes('minha_cat')
    })
    log('Categorias do user A não vazam para user B', !leaked)
    await page.close()
}

// ══════════════════════════════════════════════════════════════════════════════
// TESTE 9 — A3: getRecentMonths retorna 6 meses
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n── Teste 9: getRecentMonths retorna 6 meses ──')
{
    const page = await freshPage(browser)
    await register(page, 'João Silva Souza', '529.982.247-25', 'senha123')
    await wait(300)
    const result = await page.evaluate(() => {
        return {
            months: DataStore.getRecentMonths(),
            oldMethodExists: typeof DataStore.getAllMonthsWithData === 'function'
        }
    })
    await shot(page, '09-get-recent-months')
    log('getRecentMonths retorna 6 meses', result.months.length === 6, `retornou ${result.months.length}`)
    log('getAllMonthsWithData removido (renomeado)', !result.oldMethodExists)
    await page.close()
}

// ══════════════════════════════════════════════════════════════════════════════
// TESTE 10 — M3: mkDonutSection com objeto — overview renderiza sem erro
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n── Teste 10: Overview renderiza sem erro (M3 + M2) ──')
{
    const page = await freshPage(browser)
    const errors = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
    await register(page, 'João Silva Souza', '529.982.247-25', 'senha123')
    await wait(600)
    await shot(page, '10-overview-sem-erro')
    const jsErrors = errors.filter(e => !e.includes('favicon'))
    log('Overview renderiza sem erros JS', jsErrors.length === 0, jsErrors.length ? jsErrors[0].slice(0, 80) : '')
    await page.close()
}

// ══════════════════════════════════════════════════════════════════════════════
// TESTE 11 — M2: BankDetector.warn no console para generico
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n── Teste 11: BankDetector emite warn para banco não identificado ──')
{
    const page = await freshPage(browser)
    await register(page, 'João Silva Souza', '529.982.247-25', 'senha123')
    await wait(300)
    const warnEmitted = await page.evaluate(() => {
        const warns = []
        const orig = console.warn
        console.warn = (...a) => { warns.push(a.join(' ')); orig(...a) }
        BankDetector.fromPDFLines(['linha qualquer', 'sem banco identificado'])
        console.warn = orig
        return warns.some(w => w.includes('BankDetector'))
    })
    await shot(page, '11-bankdetector-warn')
    log('BankDetector emite warn quando cai para generico', warnEmitted)
    await page.close()
}

// ══════════════════════════════════════════════════════════════════════════════
// TESTE 12 — C1: Classifier usa regras pré-carregadas
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n── Teste 12: Classifier._categoryWithRules existe e funciona ──')
{
    const page = await freshPage(browser)
    await register(page, 'João Silva Souza', '529.982.247-25', 'senha123')
    await wait(300)
    const result = await page.evaluate(() => {
        const hasMethod = typeof Classifier._categoryWithRules === 'function'
        const rules = { 'farmácia teste': 'saude' }
        const cat1 = Classifier._categoryWithRules('Farmácia Teste', rules)
        const cat2 = Classifier._categoryWithRules('netflix', {})
        return { hasMethod, cat1, cat2 }
    })
    await shot(page, '12-classifier-rules-cache')
    log('Classifier._categoryWithRules existe', result.hasMethod)
    log('Regra customizada tem prioridade', result.cat1 === 'saude', `retornou: ${result.cat1}`)
    log('Keyword matcher funciona sem regras', result.cat2 === 'lazer', `retornou: ${result.cat2}`)
    await page.close()
}

// ══════════════════════════════════════════════════════════════════════════════
// RESUMO
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(60))
console.log(`RESULTADO: ${passed} passou  |  ${failed} falhou  |  ${passed + failed} total`)
console.log('═'.repeat(60))
console.log(`\nPrints salvos em: ${SHOTS}`)

await browser.close()
process.exit(failed > 0 ? 1 : 0)
