import { chromium } from 'playwright-core'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = 'http://localhost:5173'
const SHOTS = path.join(__dirname, 'pdf-screenshots')
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
await page.fill('#auth-name', 'Erberton Mendes Roseno')
await page.fill('#auth-cpf', '529.982.247-25')
await page.fill('#auth-pw', 'senha123')
await page.fill('#auth-pw2', 'senha123')
await page.click('.auth-btn')
await wait(700)
await shot(page, '0-logado')

// Sobe o PDF via input file
const input = page.locator('input[type=file]')
await input.setInputFiles('/Users/niltoncirne/Downloads/NU_50885557_01ABR2026_30ABR2026.pdf')
await wait(5000)
await shot(page, '1-apos-importar')

const result = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem(DataStore.KEY) || '{}')
    const exp = data.expenses || []
    const inc = data.incomes || []
    return {
        expenses: exp.length,
        incomes: inc.length,
        sampleExpenses: exp.slice(0, 3).map(e => ({ name: e.name, amount: e.amount, category: e.category })),
        sampleIncomes: inc.slice(0, 3).map(i => ({ name: i.name, amount: i.amount })),
    }
})
console.log('Resultado:', JSON.stringify(result, null, 2))

await browser.close()
