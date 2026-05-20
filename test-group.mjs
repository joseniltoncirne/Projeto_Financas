import { chromium } from 'playwright-core'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = 'http://localhost:5173'
const SHOTS = path.join(__dirname, 'group-screenshots')
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS)

const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) })
const wait = ms => new Promise(r => setTimeout(r, ms))

const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: false, slowMo: 40,
})

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
await page.goto(BASE)
await page.evaluate(() => localStorage.clear())
await page.reload()
await wait(400)

// Cadastra usuário
await page.click('#tab-register')
await wait(150)
await page.fill('#auth-name', 'João Silva Souza')
await page.fill('#auth-cpf', '529.982.247-25')
await page.fill('#auth-pw', 'senha123')
await page.fill('#auth-pw2', 'senha123')
await page.click('.auth-btn')
await wait(700)

// Injeta dados realistas com vários destinos repetidos
await page.evaluate(() => {
    const key = 'mf_data_52998224725'
    const data = {
        incomes: [{ id: 'i1', month: '2026-05', name: 'Salário', amount: 5000, bank: 'nubank' }],
        expenses: [
            // Transporte — vários destinos, alguns repetidos muitas vezes
            { id: 't1', month: '2026-05', dateStr: '02/05/2026', name: 'Uber Trip', amount: 25.50, sector: 'gasto', category: 'transporte', bank: 'nubank', expType: 'variavel' },
            { id: 't2', month: '2026-05', dateStr: '05/05/2026', name: 'Uber Trip', amount: 18.90, sector: 'gasto', category: 'transporte', bank: 'nubank', expType: 'variavel' },
            { id: 't3', month: '2026-05', dateStr: '12/05/2026', name: 'Uber Trip', amount: 31.20, sector: 'gasto', category: 'transporte', bank: 'nubank', expType: 'variavel' },
            { id: 't4', month: '2026-05', dateStr: '18/05/2026', name: 'Uber Trip', amount: 22.00, sector: 'gasto', category: 'transporte', bank: 'nubank', expType: 'variavel' },
            { id: 't5', month: '2026-05', dateStr: '03/05/2026', name: 'Posto Ipiranga', amount: 120.00, sector: 'gasto', category: 'transporte', bank: 'nubank', expType: 'variavel' },
            { id: 't6', month: '2026-05', dateStr: '17/05/2026', name: 'Posto Ipiranga', amount: 95.00, sector: 'gasto', category: 'transporte', bank: 'nubank', expType: 'variavel' },
            { id: 't7', month: '2026-05', dateStr: '07/05/2026', name: 'Estacionamento Shopping', amount: 15.00, sector: 'gasto', category: 'transporte', bank: 'nubank', expType: 'variavel' },
            { id: 't8', month: '2026-05', dateStr: '14/05/2026', name: 'Estacionamento Shopping', amount: 12.00, sector: 'gasto', category: 'transporte', bank: 'nubank', expType: 'variavel' },
            { id: 't9', month: '2026-05', dateStr: '09/05/2026', name: 'Shell da Av. Principal', amount: 75.00, sector: 'gasto', category: 'transporte', bank: 'nubank', expType: 'variavel' },
            // Alimentação
            { id: 'a1', month: '2026-05', dateStr: '01/05/2026', name: 'iFood Pedido', amount: 45.80, sector: 'gasto', category: 'alimentacao', bank: 'nubank', expType: 'variavel' },
            { id: 'a2', month: '2026-05', dateStr: '08/05/2026', name: 'iFood Pedido', amount: 38.50, sector: 'gasto', category: 'alimentacao', bank: 'nubank', expType: 'variavel' },
            { id: 'a3', month: '2026-05', dateStr: '15/05/2026', name: 'iFood Pedido', amount: 52.00, sector: 'gasto', category: 'alimentacao', bank: 'nubank', expType: 'variavel' },
            { id: 'a4', month: '2026-05', dateStr: '04/05/2026', name: 'Supermercado Extra', amount: 280.00, sector: 'gasto', category: 'alimentacao', bank: 'nubank', expType: 'variavel' },
            { id: 'a5', month: '2026-05', dateStr: '19/05/2026', name: 'Supermercado Extra', amount: 195.00, sector: 'gasto', category: 'alimentacao', bank: 'nubank', expType: 'variavel' },
            { id: 'a6', month: '2026-05', dateStr: '11/05/2026', name: 'Padaria Central', amount: 32.00, sector: 'gasto', category: 'alimentacao', bank: 'nubank', expType: 'variavel' },
        ],
        balances: { '2026-05::nubank': 3200 },
        rules: {},
        categories: {}
    }
    localStorage.setItem(key, JSON.stringify(data))
})
await page.reload()
await wait(800)

// Modal de Transporte (banco específico)
await page.evaluate(() => app.switchBank('nubank'))
await wait(400)
await page.evaluate(() => app.showCategoryDetail('transporte', 'nubank'))
await wait(400)
await shot(page, '1-transporte-agrupado-por-destino')

// Scroll down para ver mais grupos se necessário
await page.mouse.wheel(0, 200)
await wait(200)
await shot(page, '2-transporte-scroll')

// Fecha e abre Alimentação
await page.evaluate(() => document.getElementById('detail-overlay').classList.add('hidden'))
await wait(200)
await page.evaluate(() => app.showCategoryDetail('alimentacao', 'nubank'))
await wait(400)
await shot(page, '3-alimentacao-agrupado-por-destino')

await browser.close()
console.log('Prints salvos em:', SHOTS)
