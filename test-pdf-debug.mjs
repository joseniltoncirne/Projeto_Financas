import { chromium } from 'playwright-core'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SHOTS = path.join(__dirname, 'pdf-screenshots')
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS)
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) })
const wait = ms => new Promise(r => setTimeout(r, ms))

const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: false, slowMo: 30,
})
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
page.on('dialog', async d => { console.log('DIALOG:', d.message()); await d.accept() })

await page.goto('http://localhost:5173')
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

await page.locator('#ofx-input').setInputFiles('/Users/niltoncirne/Downloads/NU_50885557_01ABR2026_30ABR2026.pdf')
await wait(7000)
await shot(page, '1-modal-importacao')

const count = await page.evaluate(() => {
    return typeof app !== 'undefined' && app.importPending ? app.importPending.length : -1
})
console.log('Transações no modal:', count)
await browser.close()
