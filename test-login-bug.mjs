import { chromium } from 'playwright-core'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = 'http://localhost:5175'
const SHOTS = path.join(__dirname, 'login-bug-screenshots')
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS)

const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) })
const wait = ms => new Promise(r => setTimeout(r, ms))

let passCount = 0
let failCount = 0

function log(icon, msg) { console.log(`  ${icon}  ${msg}`) }
function ok(msg)   { passCount++; log('✅', msg) }
function fail(msg) { failCount++; log('❌', msg) }
function step(msg) { console.log(`\n${'─'.repeat(60)}\n📋 ${msg}`) }

// CPFs válidos verificados pelo algoritmo mod-11 brasileiro
// Teste 1: 529.982.247-25  Teste 2: 111.444.777-35
// Teste 3: 153.509.460-56  Teste 4: 153.509.460-56 (contexto isolado)

const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: false,
    slowMo: 80,
})

async function freshPage() {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } })
    const page = await ctx.newPage()
    page.on('console', m => { if (m.type() === 'error') log('🔴 console.error', m.text()) })
    await page.goto(BASE)
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await wait(500)
    return page
}

// ─── Teste 1: Cadastro limpo funciona normalmente ────────────────────────────
step('TESTE 1 — Cadastro normal com CPF novo')
{
    const page = await freshPage()
    await page.click('#tab-register')
    await wait(200)

    await page.fill('#auth-name', 'João Silva Souza')
    await page.fill('#auth-cpf', '529.982.247-25')
    await page.fill('#auth-pw', 'senha123')
    await page.fill('#auth-pw2', 'senha123')
    await shot(page, '01-formulario-preenchido')
    log('📸', 'Print 01 — formulário preenchido')

    await page.click('.auth-btn')
    await wait(1000)

    const authVisible = await page.isVisible('#auth-screen')
    if (!authVisible) {
        ok('App abriu após cadastro — tela de auth sumiu')
    } else {
        const err = await page.$eval('#auth-error', el => el.innerText).catch(() => '')
        fail(`Cadastro falhou. Mensagem: "${err}"`)
    }
    await shot(page, '02-pos-cadastro')
    log('📸', 'Print 02 — estado pós-cadastro')
    await page.close()
}

// ─── Teste 2: Botão desabilitado durante o async ─────────────────────────────
step('TESTE 2 — Botão fica desabilitado enquanto espera o servidor')
{
    const page = await freshPage()
    await page.click('#tab-register')
    await wait(200)

    await page.fill('#auth-name', 'Maria Santos Lima')
    await page.fill('#auth-cpf', '111.444.777-35')  // CPF válido
    await page.fill('#auth-pw', 'senha456')
    await page.fill('#auth-pw2', 'senha456')

    // Injeta delay artificial no register para conseguir checar o botão durante o await
    await page.evaluate(() => {
        const orig = window.AuthService.register.bind(window.AuthService)
        window.AuthService.register = async (...args) => {
            await new Promise(r => setTimeout(r, 300))
            return orig(...args)
        }
    })

    // Clica sem await para checar o estado do botão durante a execução
    page.click('.auth-btn')
    await wait(100)

    const disabledDuring = await page.$eval('.auth-btn', btn => btn.disabled)
    if (disabledDuring) {
        ok('Botão ficou disabled durante o await — duplo-clique bloqueado ✓')
    } else {
        fail('Botão NÃO ficou disabled — duplo-clique ainda seria possível')
    }
    await shot(page, '03-botao-disabled-durante-async')
    log('📸', 'Print 03 — botão disabled durante o cadastro')

    await wait(800) // deixa o cadastro terminar e app abrir

    const authGone = !(await page.isVisible('#auth-screen'))
    if (authGone) {
        ok('Cadastro completou com sucesso — app abriu normalmente')
    } else {
        fail('Cadastro não completou após o delay')
    }
    await page.close()
}

// ─── Teste 3: CPF já cadastrado exibe botão "Ir para login" ──────────────────
step('TESTE 3 — Tentar cadastrar CPF já existente mostra botão "Ir para login"')
{
    const page = await freshPage()

    // Passo 3a: cadastra o CPF pela primeira vez
    log('▶', 'Passo 3a: cadastrando CPF pela primeira vez...')
    await page.click('#tab-register')
    await wait(150)
    await page.fill('#auth-name', 'Carlos Pereira Neto')
    await page.fill('#auth-cpf', '153.509.460-56')  // CPF válido
    await page.fill('#auth-pw', 'senha789')
    await page.fill('#auth-pw2', 'senha789')
    await page.click('.auth-btn')
    await wait(800)

    const afterFirst = !(await page.isVisible('#auth-screen'))
    if (afterFirst) {
        ok('Passo 3a: primeiro cadastro funcionou — app abriu')
    } else {
        const err = await page.$eval('#auth-error', el => el.innerText).catch(() => '')
        fail(`Passo 3a: primeiro cadastro falhou — "${err}"`)
    }

    // Passo 3b: faz logout para voltar à tela de auth
    log('▶', 'Passo 3b: fazendo logout para simular retorno à tela de cadastro...')
    await page.evaluate(() => { if (window.auth) window.auth.logout() })
    await wait(400)

    const authBackVisible = await page.isVisible('#auth-screen')
    if (authBackVisible) {
        ok('Passo 3b: logout funcionou — tela de auth visível novamente')
    } else {
        fail('Passo 3b: tela de auth não voltou após logout')
    }

    // Passo 3c: tenta cadastrar o MESMO CPF novamente (simula o bug original)
    log('▶', 'Passo 3c: tentando cadastrar o mesmo CPF de novo (bug original)...')
    await page.click('#tab-register')
    await wait(150)
    await page.fill('#auth-name', 'Carlos Pereira Neto')
    await page.fill('#auth-cpf', '153.509.460-56')
    await page.fill('#auth-pw', 'senha789')
    await page.fill('#auth-pw2', 'senha789')
    await page.click('.auth-btn')
    await wait(600)

    await shot(page, '04-cpf-ja-cadastrado')
    log('📸', 'Print 04 — erro "CPF já cadastrado"')

    const errText = await page.$eval('#auth-error', el => el.innerText).catch(() => '')
    if (errText.includes('já cadastrado')) {
        ok(`Passo 3c: mensagem correta exibida: "${errText.trim().slice(0, 50)}..."`)
    } else {
        fail(`Passo 3c: mensagem inesperada: "${errText}"`)
    }

    // Verifica se botão "Ir para login" apareceu dentro do bloco de erro
    const loginBtn = await page.$('#auth-error button')
    if (loginBtn) {
        ok('Passo 3c: botão "Ir para login com este CPF →" presente no erro')
    } else {
        fail('Passo 3c: botão "Ir para login" NÃO encontrado no erro')
    }

    // Passo 3d: clica no botão "Ir para login com este CPF →"
    log('▶', 'Passo 3d: clicando em "Ir para login com este CPF →"...')
    await loginBtn.click()
    await wait(300)

    await shot(page, '05-apos-clicar-ir-para-login')
    log('📸', 'Print 05 — aba login após clique no botão')

    const loginTabActive = await page.$eval('#tab-login', el => el.classList.contains('active'))
    if (loginTabActive) {
        ok('Passo 3d: aba "Entrar" ficou ativa automaticamente')
    } else {
        fail('Passo 3d: aba "Entrar" NÃO ficou ativa')
    }

    // Passo 3e: verifica se CPF foi pré-preenchido no campo
    await wait(100)
    const cpfValue = await page.$eval('#auth-cpf', el => el.value).catch(() => '')
    const cpfDigits = cpfValue.replace(/\D/g, '')
    if (cpfDigits === '15350946056') {
        ok(`Passo 3e: CPF pré-preenchido corretamente: "${cpfValue}"`)
    } else {
        fail(`Passo 3e: CPF não foi pré-preenchido (atual: "${cpfValue}")`)
    }

    // Passo 3f: verifica se o foco foi para o campo de senha
    const focused = await page.evaluate(() => document.activeElement?.id)
    if (focused === 'auth-pw') {
        ok('Passo 3e: foco foi direto para o campo de senha')
    } else {
        log('⚠️ ', `Foco em: #${focused || '?'} (esperado: #auth-pw)`)
    }

    await shot(page, '05b-cpf-preenchido-campo-senha')
    log('📸', 'Print 05b — CPF preenchido, cursor no campo senha')

    // Passo 3f: completa o login para confirmar que funciona
    log('▶', 'Passo 3f: completando o login com a senha...')
    await page.fill('#auth-pw', 'senha789')
    await page.click('.auth-btn')
    await wait(800)

    await shot(page, '06-login-completo')
    log('📸', 'Print 06 — resultado do login')

    const loggedIn = !(await page.isVisible('#auth-screen'))
    if (loggedIn) {
        ok('Passo 3f: login completou com sucesso — app abriu normalmente')
    } else {
        const err2 = await page.$eval('#auth-error', el => el.innerText).catch(() => '')
        fail(`Passo 3f: login falhou após fluxo. Erro: "${err2}"`)
    }

    await page.close()
}

// ─── Teste 4: Erro de validação reabilita o botão ────────────────────────────
step('TESTE 4 — Erro de validação (senhas diferentes) reabilita o botão')
{
    const page = await freshPage()
    await page.click('#tab-register')
    await wait(150)

    await page.fill('#auth-name', 'Ana Costa Silva')
    await page.fill('#auth-cpf', '153.509.460-56')
    await page.fill('#auth-pw', 'senha111')
    await page.fill('#auth-pw2', 'senha222') // propositalmente diferente
    await page.click('.auth-btn')
    await wait(300)

    await shot(page, '07-senhas-diferentes')
    log('📸', 'Print 07 — erro "senhas não coincidem"')

    const errText = await page.$eval('#auth-error', el => el.innerText).catch(() => '')
    if (errText.includes('não coincidem')) {
        ok('Erro de senhas diferentes exibido corretamente')
    } else {
        fail(`Mensagem inesperada: "${errText}"`)
    }

    const btnEnabled = await page.$eval('.auth-btn', btn => !btn.disabled)
    if (btnEnabled) {
        ok('Botão reabilitado após erro de validação — usuário pode tentar de novo')
    } else {
        fail('Botão ficou travado após erro de validação (regressão)')
    }

    await page.close()
}

// ─── Resultado final ──────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`)
console.log(`  RESULTADO: ${passCount} ✅ passou  |  ${failCount} ❌ falhou`)
console.log(`  Prints salvos em: login-bug-screenshots/`)
console.log(`${'═'.repeat(60)}\n`)

await browser.close()
