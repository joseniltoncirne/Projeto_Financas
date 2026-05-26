'use strict'

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
var MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
var MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
var CAT_LABELS = { moradia: '🏠 Moradia', alimentacao: '🍽️ Alimentação', transporte: '🚗 Transporte', saude: '💊 Saúde', educacao: '📚 Educação', lazer: '🎮 Lazer', cartao: '💳 Cartão', outros: '📦 Outros' }
var CAT_COLORS = { moradia: '#2e7fd8', alimentacao: '#1a9e74', transporte: '#b87316', saude: '#d45828', educacao: '#6040c8', lazer: '#c83f7a', cartao: '#0891b2', outros: '#888880' }
// Snapshots imutáveis usados para resetar os globais no login/logout (evita vazamento entre usuários)
var BASE_CAT_LABELS = Object.freeze({ moradia: '🏠 Moradia', alimentacao: '🍽️ Alimentação', transporte: '🚗 Transporte', saude: '💊 Saúde', educacao: '📚 Educação', lazer: '🎮 Lazer', cartao: '💳 Cartão', outros: '📦 Outros' })
var BASE_CAT_COLORS = Object.freeze({ moradia: '#2e7fd8', alimentacao: '#1a9e74', transporte: '#b87316', saude: '#d45828', educacao: '#6040c8', lazer: '#c83f7a', cartao: '#0891b2', outros: '#888880' })
var PIE_COLORS = ['#2e7fd8', '#1a9e74', '#b87316', '#d45828', '#6040c8', '#c83f7a', '#888880']

var BANK_PIE_COLORS = {
    nubank:    ['#8A05BE', '#A033CC', '#B85CD9', '#CF85E5', '#E6AEF0', '#6D0494', '#4A007A'],
    inter:     ['#FF6200', '#FF8533', '#FFA366', '#FFBF99', '#FFD8C2', '#CC4E00', '#993B00'],
    caixa:     ['#005CA9', '#0073D4', '#338EC0', '#66AACC', '#99C5D8', '#004080', '#002850'],
    itau:      ['#EC7000', '#F08C33', '#F4A866', '#F8C499', '#FCDFC2', '#C05A00', '#944400'],
    bradesco:  ['#CC092F', '#D93B58', '#E56D82', '#F09EAB', '#F8CDD4', '#990721', '#660515'],
    santander: ['#EC0000', '#F03333', '#F46666', '#F89999', '#FBCCCC', '#B80000', '#840000'],
    bb:        ['#003087', '#0044BB', '#3368CC', '#668CDD', '#99AFEE', '#001E55', '#000E2A'],
    stone:     ['#00A868', '#00CC7E', '#33D698', '#66E0B2', '#99EACC', '#007A4C', '#004D30'],
    original:  ['#1A56DB', '#4477E5', '#6E98EE', '#98BAF7', '#C2DCFF', '#1040AA', '#0A2A79'],
    generico:  ['#2e7fd8', '#1a9e74', '#b87316', '#d45828', '#6040c8', '#c83f7a', '#888880'],
}
var SECTOR_LABELS = { gasto: 'Gasto', investido: 'Investido', em_conta: 'Em conta', entre_contas: 'Entre contas' }
var SECTOR_COLORS = {
    gasto: { bg: 'var(--red-bg)', text: 'var(--red-text)', accent: 'var(--red)' },
    investido: { bg: 'var(--purple-bg)', text: 'var(--purple-text)', accent: 'var(--purple)' },
    em_conta: { bg: 'var(--surface2)', text: 'var(--text2)', accent: 'var(--text3)' },
    entre_contas: { bg: 'var(--green-bg)', text: 'var(--green-text)', accent: 'var(--green)' },
}
var BANK_META = {
    nubank: {
        label: 'Nubank', icon: '🟣', color: '#8A05BE', bg: '#F3E8FF', textColor: '#5C0A7E',
        logo: '<img src="/banks/nubank.png" class="bank-logo" alt="Nubank">',
    },
    inter: {
        label: 'Inter', icon: '🟠', color: '#FF6200', bg: '#FFF0E6', textColor: '#9A3A00',
        logo: '<img src="/banks/inter.png" class="bank-logo" alt="Inter">',
    },
    caixa: {
        label: 'Caixa', icon: '🔵', color: '#005CA9', bg: '#E6F0FA', textColor: '#003870',
        logo: '<img src="/banks/caixa.png" class="bank-logo" alt="Caixa">',
    },
    itau: {
        label: 'Itaú', icon: '🟠', color: '#EC7000', bg: '#FFF0E0', textColor: '#7A3800',
        logo: '<svg width="20" height="20" viewBox="0 0 20 20" class="bank-logo" style="flex-shrink:0"><rect width="20" height="20" rx="5" fill="#EC7000"/><text x="10" y="13.5" text-anchor="middle" font-family="Arial,sans-serif" font-size="6.5" font-weight="900" fill="white">itaú</text></svg>',
    },
    bradesco: {
        label: 'Bradesco', icon: '🔴', color: '#CC092F', bg: '#FDEAEE', textColor: '#7A0018',
        logo: '<img src="/banks/bradesco.png" class="bank-logo" alt="Bradesco">',
    },
    santander: {
        label: 'Santander', icon: '🔴', color: '#EC0000', bg: '#FDEAEA', textColor: '#8A0000',
        logo: '<img src="/banks/santander.png" class="bank-logo" alt="Santander">',
    },
    bb: {
        label: 'Banco do Brasil', icon: '🟡', color: '#003087', bg: '#E6F0FF', textColor: '#001A50',
        logo: '<img src="/banks/bb.png" class="bank-logo" alt="Banco do Brasil">',
    },
    stone: {
        label: 'Stone', icon: '🟢', color: '#00A868', bg: '#E6F7F1', textColor: '#004D2E',
        logo: '<svg width="20" height="20" viewBox="0 0 20 20" style="vertical-align:middle;flex-shrink:0"><rect width="20" height="20" rx="5" fill="#00A868"/><polyline points="5.5,10.5 8.5,13.5 14.5,7" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
    },
    original: {
        label: 'Original', icon: '🔵', color: '#1A56DB', bg: '#EAF0FD', textColor: '#0A2E80',
        logo: '<svg width="20" height="20" viewBox="0 0 20 20" style="vertical-align:middle;flex-shrink:0"><rect width="20" height="20" rx="5" fill="#1A56DB"/><line x1="5.5" y1="5.5" x2="14.5" y2="14.5" stroke="white" stroke-width="2.5" stroke-linecap="round"/><line x1="14.5" y1="5.5" x2="5.5" y2="14.5" stroke="#FF8C00" stroke-width="2.5" stroke-linecap="round"/></svg>',
    },
    generico: {
        label: 'Outros', icon: '🏦', color: '#5a5a55', bg: '#f0efe9', textColor: '#2a2a28',
        logo: '<svg width="20" height="20" viewBox="0 0 20 20" style="vertical-align:middle;flex-shrink:0"><rect width="20" height="20" rx="5" fill="#5a5a55"/><polygon points="3,10 10,3.5 17,10" fill="white" opacity=".9"/><rect x="4.5" y="10" width="11" height="6.5" rx="1" fill="white" opacity=".9"/><rect x="8.2" y="11.5" width="3.6" height="5" rx="0.5" fill="#5a5a55"/></svg>',
    },
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLASS: AuthService — autenticação local (preparado para migração a API REST)
// Futuramente: trocar localStorage por chamadas POST /auth/login e /auth/register
