import { chromium } from 'playwright-core'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SHOTS = path.join(__dirname, 'login-bug-screenshots')
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS)

const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: false, slowMo: 60
})
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } })
await page.goto('http://localhost:5175')
await page.evaluate(() => localStorage.clear())
await page.reload()
await new Promise(r => setTimeout(r, 400))

// Cadastra
await page.click('#tab-register')
await new Promise(r => setTimeout(r, 150))
await page.fill('#auth-name', 'João Silva Souza')
await page.fill('#auth-cpf', '529.982.247-25')
await page.fill('#auth-pw', 'senha123')
await page.fill('#auth-pw2', 'senha123')
await page.click('.auth-btn')
await new Promise(r => setTimeout(r, 800))

// Injeta dados com 3 bancos para mostrar os logos todos juntos
await page.evaluate(() => {
    const key = 'mf_data_52998224725'
    localStorage.setItem(key, JSON.stringify({
        incomes: [
            { id: '1', month: '2026-05', name: 'Salário', amount: 5000, bank: 'nubank' },
            { id: '2', month: '2026-05', name: 'Freelance', amount: 1200, bank: 'inter' },
        ],
        expenses: [
            { id: '3', month: '2026-05', name: 'iFood Pedido', amount: 45, sector: 'gasto', category: 'alimentacao', bank: 'nubank', expType: 'variavel' },
            { id: '4', month: '2026-05', name: 'Supermercado', amount: 280, sector: 'gasto', category: 'alimentacao', bank: 'inter', expType: 'variavel' },
            { id: '5', month: '2026-05', name: 'CAGEPA Água', amount: 62, sector: 'gasto', category: 'moradia', bank: 'caixa', expType: 'fixo' },
            { id: '6', month: '2026-05', name: 'Energisa PB', amount: 145, sector: 'gasto', category: 'moradia', bank: 'caixa', expType: 'fixo' },
        ],
        balances: { '2026-05::nubank': 3200, '2026-05::inter': 890 },
        rules: {}, amountRules: {}, categories: {}
    }))
})
await page.reload()
await new Promise(r => setTimeout(r, 800))

// Print 1: Bank nav com os 3 logos (Geral selecionado)
await page.screenshot({ path: path.join(SHOTS, 'logos-01-geral.png') })
console.log('✅ Print 01 — bank nav geral (todos os logos visíveis)')

// Print 2: Clica em Nubank (logo ativo, branco sobre roxo)
await page.evaluate(() => app.switchBank('nubank'))
await new Promise(r => setTimeout(r, 400))
await page.screenshot({ path: path.join(SHOTS, 'logos-02-nubank-ativo.png') })
console.log('✅ Print 02 — logo Nubank ativo (branco sobre roxo)')

// Print 3: Clica em Inter
await page.evaluate(() => app.switchBank('inter'))
await new Promise(r => setTimeout(r, 400))
await page.screenshot({ path: path.join(SHOTS, 'logos-03-inter-ativo.png') })
console.log('✅ Print 03 — logo Inter ativo')

// Print 4: Clica em Caixa
await page.evaluate(() => app.switchBank('caixa'))
await new Promise(r => setTimeout(r, 400))
await page.screenshot({ path: path.join(SHOTS, 'logos-04-caixa-ativo.png') })
console.log('✅ Print 04 — logo Caixa ativo')

// Print 5: Volta para Geral e zoom no nav bar (crop via viewport menor)
await page.evaluate(() => app.switchBank('geral'))
await new Promise(r => setTimeout(r, 400))

// Captura só a área do header + nav
const navBar = await page.$('#bank-nav')
if (navBar) {
    await navBar.screenshot({ path: path.join(SHOTS, 'logos-05-nav-closeup.png') })
    console.log('✅ Print 05 — zoom close-up do bank nav')
}

await browser.close()
console.log('\nPrints salvos em: login-bug-screenshots/')
