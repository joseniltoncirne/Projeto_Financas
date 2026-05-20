import { chromium } from 'playwright-core'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = 'http://localhost:5173'
const PDF_PATH = '/Users/niltoncirne/Downloads/Joalisson Caixa.pdf'
const wait = ms => new Promise(r => setTimeout(r, ms))

const log = (step, msg, data) => {
    console.log(`\n[PASSO ${step}] ${msg}`)
    if (data !== undefined) console.log(JSON.stringify(data, null, 2))
}

const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: false, slowMo: 30,
})
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

// Captura logs do console da página
page.on('console', msg => {
    const t = msg.type()
    if (t === 'error') console.log(`[PAGE ERROR] ${msg.text()}`)
    if (t === 'warn') console.log(`[PAGE WARN] ${msg.text()}`)
    if (t === 'log') {
        const txt = msg.text()
        if (txt.startsWith('[PDF]') || txt.startsWith('[BankDetector]')) console.log(`[PAGE LOG] ${txt}`)
    }
})
page.on('dialog', async d => { console.log(`[DIALOG] ${d.message()}`); await d.accept() })

// ── PASSO 1: Abrir o app e limpar localStorage ────────────────────────────────
log(1, 'Abrindo app e limpando localStorage...')
await page.goto(BASE)
await page.evaluate(() => localStorage.clear())
await page.reload()
await wait(500)
log(1, 'App carregado ✓')

// ── PASSO 2: Criar conta ──────────────────────────────────────────────────────
log(2, 'Criando conta de teste...')
await page.click('#tab-register')
await wait(150)
await page.fill('#auth-name', 'Teste Caixa PDF')
await page.fill('#auth-cpf', '529.982.247-25')
await page.fill('#auth-pw', 'senha123')
await page.fill('#auth-pw2', 'senha123')
await page.click('.auth-btn')
await wait(800)
const loggedIn = await page.evaluate(() => !!document.getElementById('app-header') && document.getElementById('app-header').style.display !== 'none')
log(2, 'Login realizado:', { loggedIn })

// ── PASSO 3: Upload do PDF da Caixa ──────────────────────────────────────────
log(3, `Enviando arquivo: ${PDF_PATH}`)
const input = page.locator('input[type=file]')
await input.setInputFiles(PDF_PATH)
log(3, 'Arquivo enviado, aguardando OCR (pode levar 1-2 min para 5 páginas)...')

// OCR leva tempo — aguarda até o modal aparecer ou dialog aparecer (máx 3min)
let ocrdone = false
const checkDone = async () => {
    for (let i = 0; i < 180; i++) {
        await wait(1000)
        const done = await page.evaluate(() => {
            const overlay = document.getElementById('modal-overlay')
            const hasModal = overlay && !overlay.classList.contains('hidden')
            const dzTitle = document.querySelector('.drop-title')?.textContent || ''
            const isDzDefault = !dzTitle.includes('OCR') && !dzTitle.includes('Lendo')
            return hasModal || isDzDefault
        })
        if (done) { ocrdone = true; break }
        if (i % 10 === 9) log(3, `  ... aguardando OCR (${i+1}s)`)
    }
}
await checkDone()
log(3, ocrdone ? 'OCR concluído ✓' : 'Timeout aguardando OCR')

// ── PASSO 4: Verificar banco detectado e transações pendentes ─────────────────
log(4, 'Verificando resultado do parse...')
const parseResult = await page.evaluate(() => {
    if (typeof app === 'undefined') return { erro: 'app não definido' }
    const pending = app.importPending || null
    const bank = app.importer?.bank || null
    const saldo = app.importer?.saldoFinal ?? null
    const month = app.importer?.saldoMonth || null
    const debugLines = app.importer?._debugLines || null
    if (!pending || !pending.length) return {
        banco: bank,
        pendente: 0,
        debugLinhas: debugLines ? debugLines.split('\n').slice(0, 30) : null,
        erro: 'importPending vazio',
    }
    return {
        banco: bank,
        totalTransacoes: pending.length,
        saldoFinal: saldo,
        mesReferencia: month,
        primeiras5: pending.slice(0, 5).map(t => ({
            data: t.dateStr,
            mes: t.month,
            descricao: t.name || t.memo,
            valor: t.amount,
            categoria: t.category,
            tipo: t.isIncome ? 'RECEITA' : 'DESPESA',
        })),
        ultimas3: pending.slice(-3).map(t => ({
            data: t.dateStr,
            descricao: t.name,
            valor: t.amount,
        })),
        totalDespesas: pending.filter(t => !t.isIncome).length,
        totalReceitas: pending.filter(t => t.isIncome).length,
        somaDespesas: pending.filter(t => !t.isIncome).reduce((s, t) => s + t.amount, 0).toFixed(2),
        somaReceitas: pending.filter(t => t.isIncome).reduce((s, t) => s + t.amount, 0).toFixed(2),
    }
})
log(4, 'Resultado do parse:', parseResult)

if (!parseResult.totalTransacoes) {
    console.log('\n[ERRO] Nenhuma transação detectada. Abortando teste.')
    await browser.close()
    process.exit(1)
}

// ── PASSO 5: Verificar se o modal de importação está visível ──────────────────
log(5, 'Verificando modal de importação...')
const modalVisible = await page.evaluate(() => {
    const overlay = document.getElementById('import-overlay')
    const modal = document.getElementById('import-modal')
    if (!overlay && !modal) return { visivel: false, motivo: 'elementos não encontrados' }
    const el = overlay || modal
    const style = window.getComputedStyle(el)
    return {
        visivel: style.display !== 'none' && style.visibility !== 'hidden',
        display: style.display,
        id: el.id,
    }
})
log(5, 'Modal:', modalVisible)

// ── PASSO 6: Confirmar importação ─────────────────────────────────────────────
log(6, 'Procurando botão de confirmar...')
const confirmBtn = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    return btns.filter(b => /confirmar|importar|salvar|ok/i.test(b.textContent)).map(b => ({
        texto: b.textContent.trim(),
        id: b.id,
        classe: b.className,
        visivel: b.offsetParent !== null,
    }))
})
log(6, 'Botões de confirmação encontrados:', confirmBtn)

const confirmClicked = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    const btn = btns.find(b => /confirmar|importar/i.test(b.textContent) && b.offsetParent !== null)
    if (btn) { btn.click(); return btn.textContent.trim() }
    return null
})
log(6, 'Botão clicado:', confirmClicked)
await wait(1000)

// ── PASSO 7: Verificar dados salvos no localStorage ───────────────────────────
log(7, 'Verificando dados salvos...')
const storageResult = await page.evaluate(() => {
    const key = DataStore.KEY
    const raw = localStorage.getItem(key) || '{}'
    const data = JSON.parse(raw)
    const exp = data.expenses || []
    const inc = data.incomes || []
    const caixaExp = exp.filter(e => e.bank === 'caixa')
    const caixaInc = inc.filter(i => i.bank === 'caixa')
    return {
        chaveStorage: key,
        totalDespesasSalvas: exp.length,
        totalReceitasSalvas: inc.length,
        caixaDespesas: caixaExp.length,
        caixaReceitas: caixaInc.length,
        amostraDespesas: caixaExp.slice(0, 3).map(e => ({ data: e.dateStr, desc: e.name, valor: e.amount, cat: e.category })),
        amostraReceitas: caixaInc.slice(0, 3).map(i => ({ data: i.dateStr, desc: i.name, valor: i.amount })),
    }
})
log(7, 'Dados no localStorage:', storageResult)

// ── PASSO 8: Verificar aba Caixa na interface ────────────────────────────────
log(8, 'Verificando se aba Caixa aparece na nav...')
const bankTabs = await page.evaluate(() => {
    return [...document.querySelectorAll('.bank-tab')].map(t => ({
        texto: t.textContent.trim(),
        ativo: t.classList.contains('active'),
        bankId: t.dataset.bank || '',
    }))
})
log(8, 'Abas de bancos:', bankTabs)

const caixaTab = bankTabs.find(t => t.bankId === 'caixa' || /caixa/i.test(t.texto))
if (caixaTab) {
    log(8, 'Aba Caixa encontrada ✓', caixaTab)
    await page.locator('.bank-tab', { hasText: /caixa/i }).first().click()
    await wait(500)
    const caixaView = await page.evaluate(() => {
        const catItems = [...document.querySelectorAll('.cat-item')]
        return {
            categoriasVisiveis: catItems.length,
            nomes: catItems.slice(0, 5).map(c => c.querySelector('.cat-name')?.textContent?.trim()),
        }
    })
    log(8, 'View da Caixa:', caixaView)
} else {
    log(8, 'Aba Caixa NÃO encontrada na nav')
}

// ── RESUMO FINAL ──────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(60))
console.log('RESUMO DO TESTE')
console.log('═'.repeat(60))
console.log(`Banco detectado   : ${parseResult.banco}`)
console.log(`Transações parsed : ${parseResult.totalTransacoes}`)
console.log(`  → Despesas      : ${parseResult.totalDespesas}`)
console.log(`  → Receitas      : ${parseResult.totalReceitas}`)
console.log(`  → Soma despesas : R$ ${parseResult.somaDespesas}`)
console.log(`  → Soma receitas : R$ ${parseResult.somaReceitas}`)
console.log(`Saldo final       : R$ ${parseResult.saldoFinal}`)
console.log(`Mês referência    : ${parseResult.mesReferencia}`)
console.log(`Caixa no localStorage: ${storageResult.caixaDespesas} despesas, ${storageResult.caixaReceitas} receitas`)
console.log(`Aba Caixa na nav  : ${caixaTab ? 'SIM ✓' : 'NÃO ✗'}`)
console.log('═'.repeat(60))

await wait(2000)
await browser.close()
