import { chromium } from 'playwright-core'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = 'http://localhost:5173'
const SHOTS = path.join(__dirname, 'task-screenshots')
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS)

const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) })
const wait = ms => new Promise(r => setTimeout(r, ms))

const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: false, slowMo: 60,
})

async function freshPage() {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } })
    const page = await ctx.newPage()
    await page.goto(BASE)
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await wait(400)
    return page
}

async function register(page, name = 'João Silva Souza', cpf = '529.982.247-25', pw = 'senha123') {
    await page.click('#tab-register')
    await wait(150)
    await page.fill('#auth-name', name)
    await page.fill('#auth-cpf', cpf)
    await page.fill('#auth-pw', pw)
    await page.fill('#auth-pw2', pw)
    await page.click('.auth-btn')
    await wait(700)
}

// ── Setup: cria conta com categorias customizadas e gastos de exemplo ──────────
const page = await freshPage()
await register(page)

// Injeta categorias "Estacionamento" e "Gasolina" SEM emoji (simula estado antigo)
// e gastos de exemplo para testar o agrupamento
await page.evaluate(() => {
    const key = 'mf_data_52998224725'
    const data = {
        incomes: [],
        expenses: [
            // Transporte — vários gastos para o mesmo destino
            { id: '1', month: '2026-05', dateStr: '01/05/2026', name: 'Uber Trip', amount: 25.50, sector: 'gasto', category: 'transporte', bank: 'nubank', expType: 'variavel' },
            { id: '2', month: '2026-05', dateStr: '05/05/2026', name: 'Uber Trip', amount: 18.90, sector: 'gasto', category: 'transporte', bank: 'nubank', expType: 'variavel' },
            { id: '3', month: '2026-05', dateStr: '10/05/2026', name: 'Uber Trip', amount: 31.20, sector: 'gasto', category: 'transporte', bank: 'nubank', expType: 'variavel' },
            { id: '4', month: '2026-05', dateStr: '03/05/2026', name: 'Posto Ipiranga', amount: 120.00, sector: 'gasto', category: 'transporte', bank: 'nubank', expType: 'variavel' },
            { id: '5', month: '2026-05', dateStr: '15/05/2026', name: 'Posto Ipiranga', amount: 95.00, sector: 'gasto', category: 'transporte', bank: 'nubank', expType: 'variavel' },
            { id: '6', month: '2026-05', dateStr: '07/05/2026', name: 'Estacionamento Shoping', amount: 15.00, sector: 'gasto', category: 'transporte', bank: 'nubank', expType: 'variavel' },
            // Alimentação — gastos únicos e repetidos
            { id: '7', month: '2026-05', dateStr: '02/05/2026', name: 'iFood Pedido', amount: 45.80, sector: 'gasto', category: 'alimentacao', bank: 'nubank', expType: 'variavel' },
            { id: '8', month: '2026-05', dateStr: '09/05/2026', name: 'iFood Pedido', amount: 38.50, sector: 'gasto', category: 'alimentacao', bank: 'nubank', expType: 'variavel' },
            { id: '9', month: '2026-05', dateStr: '04/05/2026', name: 'Supermercado Extra', amount: 280.00, sector: 'gasto', category: 'alimentacao', bank: 'nubank', expType: 'variavel' },
        ],
        balances: { '2026-05::nubank': 1500 },
        rules: {},
        categories: {
            // Categorias sem emoji (estado antigo que deve ser auto-corrigido)
            estacionamento: { label: 'Estacionamento', color: '#f59e0b' },
            gasolina: { label: 'Gasolina', color: '#10b981' },
        }
    }
    localStorage.setItem(key, JSON.stringify(data))
    // Injeta também o banco nubank nos dados
    const usersKey = 'mf_users'
    const users = JSON.parse(localStorage.getItem(usersKey) || '{}')
    // já foi criado pelo register, só garante que o banco nubank aparece
})

await page.reload()
await wait(800)

// ── PRINT 1: Nav sem "Importar banco", ver se ficou limpo ─────────────────────
await shot(page, '1-nav-sem-importar-banco')

// ── PRINT 2: Overview sem "Ver movimentações entre contas" ────────────────────
await page.evaluate(() => app.switchBank('geral'))
await wait(500)
await shot(page, '2-overview-sem-entre-contas-btn')

// ── PRINT 3: Categorias customizadas com emoji auto-corrigido ─────────────────
// Abre o detalhe do Nubank para ver nav de bancos e categorias
await page.evaluate(() => app.switchBank('nubank'))
await wait(500)
await shot(page, '3-nav-banco-nubank')

// Clica em Gastos para ver a lista com categorias
await page.click('[onclick="app.switchTab(\'gastos\')"]')
await wait(400)
await shot(page, '4-gastos-com-categorias-emoji')

// ── PRINT 4: Abre geral > clica em categoria Transporte ───────────────────────
await page.evaluate(() => app.switchBank('geral'))
await wait(400)
await page.evaluate(() => app.showCategoryDetail('transporte', ''))
await wait(300)
await shot(page, '5-categoria-transporte-agrupado')

// ── PRINT 5: Categoria Alimentação agrupada ───────────────────────────────────
await page.evaluate(() => { document.getElementById('detail-overlay').classList.add('hidden') })
await wait(200)
await page.evaluate(() => app.showCategoryDetail('alimentacao', ''))
await wait(300)
await shot(page, '6-categoria-alimentacao-agrupado')

// ── PRINT 6: Cria nova categoria e verifica emoji ─────────────────────────────
await page.evaluate(() => { document.getElementById('detail-overlay').classList.add('hidden') })
await wait(200)

// Intercepta o prompt para criar nova categoria
await page.evaluate(() => {
    window._origPrompt = window.prompt
    window.prompt = () => 'Gasolina'
})
await page.evaluate(() => app._createCustomCategory())
await page.evaluate(() => { window.prompt = window._origPrompt })
await wait(300)

// Abre o detail-overlay para ver as categorias no select
await page.evaluate(() => app.showCategoryDetail('transporte', ''))
await wait(300)
await shot(page, '7-nova-categoria-com-emoji')

// ── PRINT 7: Edita categoria e verifica novo emoji ────────────────────────────
await page.evaluate(() => { document.getElementById('detail-overlay').classList.add('hidden') })
await wait(200)

// Intercepta prompt para renomear
await page.evaluate(() => {
    window._origPrompt = window.prompt
    window.prompt = () => 'Estacionamento'
})
await page.evaluate(() => app.editCategoryName('estacionamento', ''))
await page.evaluate(() => { window.prompt = window._origPrompt })
await wait(300)
await page.evaluate(() => app.showCategoryDetail('estacionamento', ''))
await wait(300)
await shot(page, '8-categoria-editada-com-emoji')

// ── PRINT 8: Categorias no Geral > overview card de categorias ────────────────
await page.evaluate(() => { document.getElementById('detail-overlay').classList.add('hidden') })
await wait(200)
await page.evaluate(() => app.switchBank('geral'))
await wait(500)
await shot(page, '9-overview-categorias-com-emoji')

await browser.close()
console.log(`\nPrints salvos em: ${SHOTS}`)
