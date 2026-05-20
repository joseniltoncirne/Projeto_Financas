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
        logo: '<svg width="20" height="20" viewBox="0 0 20 20" style="vertical-align:middle;flex-shrink:0"><rect width="20" height="20" rx="5" fill="#8A05BE"/><text x="10" y="13.5" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="8" font-weight="700" fill="white" letter-spacing="0.8">nu</text></svg>',
    },
    inter: {
        label: 'Inter', icon: '🟠', color: '#FF6200', bg: '#FFF0E6', textColor: '#9A3A00',
        logo: '<svg width="20" height="20" viewBox="0 0 20 20" style="vertical-align:middle;flex-shrink:0"><rect width="20" height="20" rx="4" fill="#FF6200"/><line x1="2" y1="18" x2="18" y2="2" stroke="white" stroke-width="1.8" stroke-linecap="round"/><line x1="2" y1="18" x2="14" y2="2" stroke="white" stroke-width="1.8" stroke-linecap="round"/><line x1="2" y1="18" x2="9" y2="2" stroke="white" stroke-width="1.8" stroke-linecap="round"/><line x1="2" y1="18" x2="4" y2="2" stroke="white" stroke-width="1.8" stroke-linecap="round"/><line x1="2" y1="18" x2="2" y2="6" stroke="white" stroke-width="1.8" stroke-linecap="round"/><line x1="2" y1="18" x2="18" y2="8" stroke="white" stroke-width="1.8" stroke-linecap="round"/><line x1="2" y1="18" x2="18" y2="14" stroke="white" stroke-width="1.8" stroke-linecap="round"/></svg>',
    },
    caixa: {
        label: 'Caixa', icon: '🔵', color: '#005CA9', bg: '#E6F0FA', textColor: '#003870',
        logo: '<svg width="20" height="20" viewBox="0 0 20 20" style="vertical-align:middle;flex-shrink:0"><rect width="20" height="20" rx="4" fill="#1565C0"/><polygon points="10,2 18,2 10,18 2,18" fill="#E84E0F"/><polygon points="2,2 10,2 18,18 10,18" fill="white"/></svg>',
    },
    itau: {
        label: 'Itaú', icon: '🟠', color: '#EC7000', bg: '#FFF0E0', textColor: '#7A3800',
        logo: '<svg width="20" height="20" viewBox="0 0 20 20" style="vertical-align:middle;flex-shrink:0"><rect width="20" height="20" rx="5" fill="#EC7000"/><text x="10" y="13.5" text-anchor="middle" font-family="Arial,sans-serif" font-size="6.5" font-weight="900" fill="white">itaú</text></svg>',
    },
    bradesco: {
        label: 'Bradesco', icon: '🔴', color: '#CC092F', bg: '#FDEAEE', textColor: '#7A0018',
        logo: '<svg width="20" height="20" viewBox="0 0 20 20" style="vertical-align:middle;flex-shrink:0"><rect width="20" height="20" rx="5" fill="#CC092F"/><path d="M10 14.5 L10 9" stroke="white" stroke-width="1.8" stroke-linecap="round"/><path d="M10 9 Q8 6.5 6 5" stroke="white" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M10 9 Q12 6.5 14 5" stroke="white" stroke-width="1.8" fill="none" stroke-linecap="round"/><rect x="5.2" y="14" width="1.8" height="3.5" rx="0.6" fill="white"/><rect x="13" y="14" width="1.8" height="3.5" rx="0.6" fill="white"/></svg>',
    },
    santander: {
        label: 'Santander', icon: '🔴', color: '#EC0000', bg: '#FDEAEA', textColor: '#8A0000',
        logo: '<svg width="20" height="20" viewBox="0 0 20 20" style="vertical-align:middle;flex-shrink:0"><rect width="20" height="20" rx="5" fill="#EC0000"/><path d="M10 5C10 5 7 9 7.5 12.5C8 15.2 8.8 15.5 10 15.5C11.2 15.5 12 15.2 12.5 12.5C13 9 10 5 10 5Z" fill="white"/></svg>',
    },
    bb: {
        label: 'Banco do Brasil', icon: '🟡', color: '#003087', bg: '#E6F0FF', textColor: '#001A50',
        logo: '<svg width="20" height="20" viewBox="0 0 20 20" style="vertical-align:middle;flex-shrink:0"><circle cx="10" cy="10" r="9.5" fill="#003087"/><text x="10" y="13.5" text-anchor="middle" font-family="Arial,sans-serif" font-size="8" font-weight="900" fill="#FFCC00">BB</text></svg>',
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
