import { chromium } from 'playwright-core'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = 'http://localhost:5173'
const SHOTS = path.join(__dirname, 'pin-screenshots')
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

await page.click('#tab-register')
await wait(150)
await page.fill('#auth-name', 'João Silva Souza')
await page.fill('#auth-cpf', '529.982.247-25')
await page.fill('#auth-pw', 'senha123')
await page.fill('#auth-pw2', 'senha123')
await page.click('.auth-btn')
await wait(700)

await page.evaluate(() => {
    localStorage.setItem('mf_data_52998224725', JSON.stringify({
        incomes: [],
        expenses: [
            { id: 'e1', month: '2026-05', dateStr: '01/05/2026', name: 'Pix Enviado Ifood Com Agencia de Restaurantes Online', amount: 45.80, sector: 'gasto', category: 'alimentacao', bank: 'nubank', expType: 'variavel' },
            { id: 'e2', month: '2026-05', dateStr: '08/05/2026', name: 'Pix Enviado Ifood.com Agencia de Restaurantes Online', amount: 38.50, sector: 'gasto', category: 'alimentacao', bank: 'nubank', expType: 'variavel' },
            { id: 'e3', month: '2026-05', dateStr: '15/05/2026', name: 'Pix Enviado Ifood Com Agencia de Restaurantes Online', amount: 460.50, sector: 'gasto', category: 'cartao', bank: 'nubank', expType: 'variavel' },
        ],
        balances: {}, rules: {}, amountRules: {}, categories: {}
    }))
})
await page.reload()
await wait(800)

await page.evaluate(() => app.switchBank('nubank'))
await wait(400)
await page.evaluate(() => app.showCategoryDetail('alimentacao', 'nubank'))
await wait(400)
await shot(page, '1-antes-do-pin')

// Clica no botão "Fixar valor" do terceiro gasto (R$460,50) — está em categoria cartao
// mas exibido em alimentacao porque ambos os IFoods estão em alimentacao
// Vamos abrir o detalhe de cartao onde está o e3
await page.evaluate(() => { document.getElementById('detail-overlay').classList.add('hidden') })
await wait(200)
await page.evaluate(() => app.showCategoryDetail('cartao', 'nubank'))
await wait(400)
await shot(page, '2-cartao-sem-pin')

// Clica no fixar valor do único item
const btn = page.locator('button', { hasText: 'Fixar valor' }).first()
await btn.click()
await wait(500)
await shot(page, '3-cartao-com-pin-verde')

// Clica novamente para desmarcar
const pinnedBtn = page.locator('button', { hasText: 'Fixado' }).first()
await pinnedBtn.click()
await wait(500)
await shot(page, '4-cartao-sem-pin-de-novo')

await browser.close()
console.log('Prints salvos em:', SHOTS)
