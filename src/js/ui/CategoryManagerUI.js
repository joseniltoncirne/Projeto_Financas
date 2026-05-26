// ─────────────────────────────────────────────────────────────────────────────
// CategoryManagerUI — gestão de categorias, alias e regras de valor
// ─────────────────────────────────────────────────────────────────────────────

Object.assign(FinanceApp.prototype, {

    // ── Sincronização de categorias customizadas ──────────────────────────────
    _syncCustomCategories() {
        Object.keys(CAT_LABELS).forEach(k => { if (!(k in BASE_CAT_LABELS)) delete CAT_LABELS[k] })
        Object.assign(CAT_LABELS, BASE_CAT_LABELS)
        Object.keys(CAT_COLORS).forEach(k => { if (!(k in BASE_CAT_COLORS)) delete CAT_COLORS[k] })
        Object.assign(CAT_COLORS, BASE_CAT_COLORS)
        const custom = DataStore.getCustomCategories()
        const emojiRe = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u
        for (const [key, cat] of Object.entries(custom)) {
            if (cat.isFixed) continue  // categorias de gastos fixos ficam separadas
            let label = cat.label
            if (!emojiRe.test(label)) {
                const emoji = this._emojiForName(label)
                label = `${emoji} ${label}`
                DataStore.renameCategory(key, label)
            }
            CAT_LABELS[key] = label
            CAT_COLORS[key] = cat.color
        }
    },

    _emojiForName(name) {
        const n = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        const map = [
            ['⛽', ['gasolina', 'combustivel', 'etanol', 'alcool combust', 'diesel', 'posto combustiv', 'abastec']],
            ['🅿️', ['estacionamento', 'parking', 'zona azul', 'vaga']],
            ['🏠', ['moradia', 'aluguel', 'condominio', 'iptu', 'casa', 'apartamento', 'energia elet', 'conta de luz', 'agua', 'gas encanado', 'internet', 'banda larga']],
            ['🍽️', ['alimentacao', 'alimenta', 'comida', 'refeicao', 'restaurante', 'lanche', 'mercado', 'supermercado', 'padaria', 'ifood', 'delivery', 'pizza', 'sushi']],
            ['🚗', ['transporte', 'uber', 'taxi', 'corrida', 'onibus', 'metro', 'pedagio', 'passagem']],
            ['💊', ['saude', 'farmacia', 'medico', 'hospital', 'plano de saude', 'consulta', 'dentista', 'exame', 'remedio']],
            ['📚', ['educacao', 'escola', 'faculdade', 'curso', 'livro', 'papelaria', 'treinamento']],
            ['🎮', ['lazer', 'entretenimento', 'netflix', 'spotify', 'cinema', 'jogo', 'game', 'streaming', 'serie']],
            ['💳', ['cartao', 'fatura', 'credito']],
            ['🐾', ['pet', 'animal', 'veterinario', 'cachorro', 'gato', 'racao']],
            ['👗', ['roupa', 'vestuario', 'moda', 'calcado', 'sapato', 'tenis', 'camisa']],
            ['✈️', ['viagem', 'passagem aer', 'hotel', 'hospedagem', 'turismo', 'airbnb']],
            ['🏋️', ['academia', 'fitness', 'gym', 'esporte', 'pilates', 'crossfit']],
            ['🎁', ['presente', 'gift', 'doacao', 'brinde']],
            ['🔧', ['manutencao', 'reparo', 'conserto', 'mecanico', 'oficina', 'reforma']],
            ['📱', ['celular', 'telefone', 'smartphone', 'plano cel']],
            ['💰', ['investimento', 'poupanca', 'aplicacao', 'reserva', 'rendimento']],
            ['🏦', ['banco', 'financeiro', 'emprestimo', 'financiamento']],
            ['🛒', ['compras', 'shopping', 'loja', 'magazine']],
        ]
        for (const [emoji, keywords] of map) {
            if (keywords.some(k => n.includes(k))) return emoji
        }
        return '📦'
    },

    _slugify(str) {
        return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'custom'
    },

    _nextCustomColor() {
        const palette = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#84cc16', '#a855f7', '#06b6d4']
        const count = Object.keys(DataStore.getCustomCategories()).length
        return palette[count % palette.length]
    },

    async _createCustomCategory() {
        let subtitle = ''
        let defaultValue = ''
        // Loop até nome válido ou cancelamento — re-abre o modal com erro inline
        while (true) {
            const name = await this._showInputModal({
                title: '➕ Nova categoria',
                label: 'Nome',
                placeholder: 'Ex: Estacionamento',
                confirmLabel: 'Criar',
                subtitle,
                defaultValue,
            })
            if (!name?.trim()) return null
            const trimmed = name.trim()
            const key = this._slugify(trimmed)
            if (!key) {
                subtitle = '⚠️ Use letras ou números no nome.'
                defaultValue = trimmed
                continue
            }
            // Colisão com categoria existente (base ou customizada)
            if (CAT_LABELS[key]) {
                subtitle = `⚠️ Já existe a categoria "${Renderer.esc(CAT_LABELS[key])}". Escolha outro nome.`
                defaultValue = trimmed
                continue
            }
            const color = this._nextCustomColor()
            const emoji = this._emojiForName(trimmed)
            try {
                await DataStore.addCustomCategory(key, `${emoji} ${trimmed}`, color)
                this._syncCustomCategories()
                return key
            } catch (e) {
                subtitle = `⚠️ ${e?.body?.message || 'Erro ao criar categoria.'}`
                defaultValue = trimmed
                continue
            }
        }
    },

    // ── Alteração de categoria ─────────────────────────────────────────────────
    async changeExpenseCategory(id, newCat, currentCat, bank) {
        const expense = DataStore.getExpenseById(id)
        if (!expense) { this.showCategoryDetail(currentCat, bank || null); return }

        const memoLower = expense.name.toLowerCase()
        // Exclui transações com 📌 Fixar valor — o pin é mais específico que a regra por memo,
        // então não faz sentido oferecê-las no fluxo de "aplicar a todos com mesmo nome"
        const amountRules = DataStore.getAmountRules() || {}
        const isPinned = e => !!amountRules[`${Classifier._normalizeKey(e.name)}::${e.amount.toFixed(2)}`]
        const others = DataStore.load().expenses.filter(e =>
            String(e.id) !== String(id) &&
            e.name.toLowerCase() === memoLower &&
            e.category !== newCat &&
            !isPinned(e)
        )

        try {
            await DataStore.updateExpenseCategory(id, newCat)
        } catch (e) {
            this._showToast('Erro ao alterar categoria.', 'toast-error')
            return
        }

        // Guarda para perguntar sobre regra automática depois (após eventual modal de bulk)
        this._pendingRuleToast = { memoLower, newCat, originalName: expense.name }

        if (others.length > 0) {
            this._bulkPending = { memoLower, newCat, currentCat, bank: bank || null }

            const fmt = Renderer.fmt.bind(Renderer)
            const esc = Renderer.esc.bind(Renderer)
            const catLabel = CAT_LABELS[newCat] || newCat
            const catColor = CAT_COLORS[newCat] || '#888'
            const s = others.length > 1 ? 's' : ''
            const total = others.reduce((acc, e) => acc + e.amount, 0)

            const preview = others.slice(0, 3)
            const more = others.length - preview.length
            const previewHtml = `<div style="background:var(--surface);border-radius:8px;padding:.6rem .9rem;margin-bottom:1rem;text-align:left">
                ${preview.map((e, i) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;${i < preview.length - 1 || more > 0 ? 'border-bottom:1px solid var(--border)' : ''}">
                    <span style="font-size:12px;color:var(--text3)">${esc(e.dateStr || e.month)}</span>
                    <span style="font-size:13px;font-weight:600">${fmt(e.amount)}</span>
                </div>`).join('')}
                ${more > 0 ? `<div style="font-size:12px;color:var(--text3);padding-top:6px;text-align:center">e mais ${more} lançamento${more > 1 ? 's' : ''}...</div>` : ''}
            </div>`

            document.getElementById('detail-title').innerHTML = `🏷️ Alterar categoria em lote?`
            document.getElementById('detail-body').innerHTML = `
                <div style="text-align:center;padding:.5rem 0 1rem">
                    <div style="width:52px;height:52px;border-radius:50%;background:${catColor}22;display:flex;align-items:center;justify-content:center;font-size:26px;margin:0 auto .75rem">🏷️</div>
                    <div style="font-size:15px;font-weight:800;color:var(--text);margin-bottom:.4rem">
                        ${others.length} outro${s} gasto${s} igual encontrado${s}
                    </div>
                    <div style="font-size:13px;color:var(--text2);margin-bottom:.6rem;line-height:1.5">
                        Nome: <span style="font-family:monospace;background:var(--surface2);border-radius:6px;padding:2px 8px;font-size:12px">${esc(expense.name)}</span>
                    </div>
                    <div style="font-size:12px;color:var(--text3);margin-bottom:1rem">Total nos outros lançamentos: <strong style="color:var(--text2)">${fmt(total)}</strong></div>
                    ${previewHtml}
                    <div style="font-size:13px;color:var(--text2);margin-bottom:1.25rem">
                        Deseja mover todos para <span style="color:${catColor};font-weight:700">${esc(catLabel)}</span>?
                    </div>
                    <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
                        <button onclick="app._confirmBulkCat(true)"
                            style="padding:10px 22px;border-radius:8px;border:none;background:${catColor};color:#fff;font-size:13px;font-weight:700;cursor:pointer;transition:opacity .15s"
                            onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
                            ✓ Aplicar a todos
                        </button>
                        <button onclick="app._confirmBulkCat(false)"
                            style="padding:10px 22px;border-radius:8px;border:1.5px solid var(--border);background:transparent;color:var(--text2);font-size:13px;font-weight:600;cursor:pointer">
                            Só este gasto
                        </button>
                    </div>
                </div>`
            document.getElementById('detail-overlay').classList.remove('hidden')
            return
        }

        this.showCategoryDetail(currentCat, bank || null)
        this.render()
        setTimeout(() => this._renderOverviewChart(), 50)
        this._showRuleCreatedToast()
    },

    _showRuleCreatedToast() {
        const p = this._pendingRuleToast
        if (!p) return
        this._pendingRuleToast = null
        const catLabel = CAT_LABELS[p.newCat] || p.newCat
        this._showToast(
            `Transações futuras iguais a essa irão sempre para ${catLabel}?`,
            'toast-info',
            [
                {
                    label: 'Não é regra',
                    onClick: () => { /* nada — só dispensa */ },
                },
                {
                    label: 'Aplicar regra',
                    primary: true,
                    onClick: async () => {
                        try {
                            await DataStore.setRule(p.memoLower, p.newCat)
                            this._showToast('✓ Regra automática criada', 'toast-success')
                        } catch {
                            this._showToast('Erro ao criar regra', 'toast-error')
                        }
                    },
                },
            ],
        )
    },

    async _confirmBulkCat(applyAll) {
        const p = this._bulkPending
        if (!p) return
        this._bulkPending = null
        if (applyAll) {
            try {
                await DataStore.bulkUpdateExpenseCategories(p.memoLower, p.newCat)
            } catch (e) {
                this._showToast('Erro ao atualizar categorias.', 'toast-error')
                return
            }
        }
        this.showCategoryDetail(p.currentCat, p.bank)
        this.render()
        setTimeout(() => this._renderOverviewChart(), 50)
        // Mostra o toast de regra criada (não usa o de "atualizado em lote" — esse
        // é redundante com o próprio modal que o usuário acabou de confirmar)
        this._showRuleCreatedToast()
    },

    // ── Renomear categoria ─────────────────────────────────────────────────────
    editCategoryName(category, bankArg) {
        const current = CAT_LABELS[category] || category
        const emojiRe = /^([\p{Emoji_Presentation}\p{Extended_Pictographic}])\s*/u
        const currentEmoji = emojiRe.exec(current)?.[1] || this._emojiForName(current)
        const currentName = current.replace(emojiRe, '').trim()

        const customCat = DataStore.getCustomCategories()[category]
        const isBaseCategory = category in BASE_CAT_LABELS
        const isFixedCategory = !!customCat?.isFixed
        const canDelete = !isBaseCategory && !isFixedCategory

        this._catRenameState = { category, bankArg, selectedEmoji: currentEmoji }

        const EMOJIS = [
            // Moradia / casa
            { e: '🏠', t: 'casa moradia lar residencia' },
            { e: '🏡', t: 'casa jardim quintal moradia' },
            { e: '🛋️', t: 'sofa sala moveis decoracao' },
            { e: '🔑', t: 'chave aluguel casa' },
            { e: '🪴', t: 'planta vaso decoracao jardim' },
            { e: '🚿', t: 'chuveiro banho agua' },
            { e: '🛁', t: 'banheira banho' },
            { e: '🪟', t: 'janela casa' },
            { e: '🧹', t: 'limpeza vassoura faxina' },
            { e: '🧺', t: 'lavanderia roupas cesto' },
            // Alimentação
            { e: '🍽️', t: 'comida prato refeicao restaurante alimentacao' },
            { e: '🍕', t: 'pizza comida' },
            { e: '🍔', t: 'hamburguer lanche fast food' },
            { e: '🌮', t: 'taco mexicano comida' },
            { e: '🍜', t: 'macarrao sopa lamen comida' },
            { e: '🍣', t: 'sushi japones comida' },
            { e: '🥗', t: 'salada saudavel comida' },
            { e: '🥩', t: 'carne churrasco comida' },
            { e: '🥦', t: 'brocolis verdura legumes saudavel' },
            { e: '🍰', t: 'bolo doce sobremesa' },
            { e: '☕', t: 'cafe bebida padaria' },
            { e: '🍺', t: 'cerveja bebida bar' },
            { e: '🍷', t: 'vinho bebida bar' },
            { e: '🧃', t: 'suco bebida' },
            { e: '🫖', t: 'cha bebida' },
            // Transporte
            { e: '🚗', t: 'carro transporte automovel veiculo' },
            { e: '⛽', t: 'gasolina combustivel posto etanol' },
            { e: '🚌', t: 'onibus transporte publico' },
            { e: '🚇', t: 'metro transporte publico' },
            { e: '🛵', t: 'moto scooter transporte' },
            { e: '🚲', t: 'bicicleta bike transporte' },
            { e: '✈️', t: 'aviao viagem passagem aerea' },
            { e: '🚢', t: 'barco navio viagem cruzeiro' },
            { e: '🅿️', t: 'estacionamento parking vaga' },
            { e: '🛴', t: 'patinete transporte' },
            // Saúde
            { e: '💊', t: 'remedio farmacia medicamento saude' },
            { e: '🏥', t: 'hospital saude medico' },
            { e: '🩺', t: 'consulta medico saude estetoscopio' },
            { e: '🩹', t: 'curativo saude primeiros socorros' },
            { e: '🧘', t: 'yoga meditacao bem estar' },
            { e: '💉', t: 'vacina injecao saude' },
            { e: '🦷', t: 'dente dentista saude' },
            { e: '👁️', t: 'olho oftalmologia oculos saude vista' },
            // Educação
            { e: '📚', t: 'livros educacao estudo escola' },
            { e: '🎓', t: 'formatura faculdade graduacao educacao' },
            { e: '✏️', t: 'lapis escola educacao papelaria' },
            { e: '🖊️', t: 'caneta escola educacao papelaria' },
            { e: '📐', t: 'regua escola educacao papelaria' },
            { e: '🖥️', t: 'computador desktop trabalho' },
            { e: '💻', t: 'notebook laptop trabalho' },
            // Lazer
            { e: '🎮', t: 'jogos games videogame lazer' },
            { e: '🎬', t: 'cinema filme lazer' },
            { e: '🎵', t: 'musica spotify streaming lazer' },
            { e: '🎨', t: 'arte pintura hobby lazer' },
            { e: '🎭', t: 'teatro arte lazer' },
            { e: '⚽', t: 'futebol esporte bola' },
            { e: '🏀', t: 'basquete esporte bola' },
            { e: '🎾', t: 'tenis esporte bola' },
            { e: '🏊', t: 'natacao piscina esporte' },
            { e: '🚴', t: 'ciclismo bike esporte' },
            { e: '🏋️', t: 'academia musculacao fitness esporte' },
            { e: '🎳', t: 'boliche esporte lazer' },
            { e: '🎯', t: 'meta dardos lazer' },
            { e: '🏖️', t: 'praia ferias viagem lazer' },
            // Compras / moda
            { e: '🛒', t: 'compras mercado supermercado carrinho' },
            { e: '👗', t: 'vestido roupa moda' },
            { e: '👠', t: 'sapato salto moda' },
            { e: '👜', t: 'bolsa moda acessorio' },
            { e: '💍', t: 'aliança anel joia presente' },
            { e: '🕶️', t: 'oculos sol moda acessorio' },
            { e: '🎒', t: 'mochila escola viagem' },
            { e: '💄', t: 'maquiagem batom beleza' },
            // Financeiro
            { e: '💳', t: 'cartao credito fatura financeiro' },
            { e: '💰', t: 'dinheiro investimento poupanca financeiro' },
            { e: '💸', t: 'dinheiro voando gasto financeiro' },
            { e: '🏦', t: 'banco financeiro' },
            { e: '📈', t: 'grafico investimento bolsa financeiro' },
            { e: '🪙', t: 'moeda dinheiro financeiro' },
            { e: '💵', t: 'dinheiro nota cash financeiro' },
            // Pets
            { e: '🐾', t: 'pet animal patinha' },
            { e: '🐶', t: 'cachorro pet dog' },
            { e: '🐱', t: 'gato pet cat' },
            { e: '🐠', t: 'peixe aquario pet' },
            { e: '🐦', t: 'passaro pet' },
            { e: '🐇', t: 'coelho pet' },
            // Pessoal / presentes
            { e: '👶', t: 'bebe filho crianca' },
            { e: '👨‍👩‍👧', t: 'familia pais' },
            { e: '💅', t: 'unha manicure beleza estetica' },
            { e: '🎁', t: 'presente gift' },
            { e: '🌹', t: 'flor rosa presente' },
            // Trabalho / ferramentas
            { e: '💼', t: 'trabalho maleta business' },
            { e: '📊', t: 'grafico relatorio trabalho' },
            { e: '📋', t: 'lista relatorio prancheta trabalho' },
            { e: '📱', t: 'celular telefone smartphone' },
            { e: '🔧', t: 'ferramenta chave manutencao conserto' },
            { e: '🖨️', t: 'impressora escritorio trabalho' },
            // Viagem
            { e: '🧳', t: 'mala viagem' },
            { e: '🗺️', t: 'mapa viagem' },
            { e: '🏕️', t: 'camping acampamento viagem' },
            { e: '🗼', t: 'torre paris viagem turismo' },
            { e: '🏰', t: 'castelo turismo viagem' },
            // Natureza / clima
            { e: '🌿', t: 'planta natureza folhas' },
            { e: '🌻', t: 'girassol flor natureza' },
            { e: '🌴', t: 'palmeira praia natureza' },
            { e: '🍀', t: 'trevo sorte natureza' },
            { e: '🌾', t: 'trigo natureza' },
            { e: '☀️', t: 'sol clima' },
            { e: '🌧️', t: 'chuva clima' },
            // Outros
            { e: '📦', t: 'caixa outros geral pacote' },
            { e: '🎀', t: 'laço presente decoracao' },
            { e: '⭐', t: 'estrela favorito destaque' },
            { e: '🔔', t: 'sino notificacao lembrete' },
            { e: '🏷️', t: 'etiqueta tag rotulo' },
            // Alimentação extra
            { e: '🍞', t: 'pao padaria comida' },
            { e: '🥐', t: 'croissant padaria comida' },
            { e: '🥖', t: 'pao frances baguete padaria' },
            { e: '🥪', t: 'sanduiche lanche comida' },
            { e: '🍝', t: 'massa macarrao comida' },
            { e: '🍳', t: 'ovo cafe da manha comida' },
            { e: '🥚', t: 'ovo comida' },
            { e: '🧀', t: 'queijo comida' },
            { e: '🍦', t: 'sorvete sobremesa doce' },
            { e: '🍫', t: 'chocolate doce sobremesa' },
            { e: '🍪', t: 'biscoito cookie doce' },
            { e: '🍩', t: 'rosquinha donut doce' },
            { e: '🍯', t: 'mel doce' },
            { e: '🥤', t: 'refrigerante bebida' },
            { e: '🧊', t: 'gelo bebida' },
            // Frutas e legumes
            { e: '🍎', t: 'maca fruta hortifruti' },
            { e: '🍌', t: 'banana fruta hortifruti' },
            { e: '🍇', t: 'uva fruta hortifruti' },
            { e: '🍊', t: 'laranja fruta hortifruti' },
            { e: '🍓', t: 'morango fruta hortifruti' },
            { e: '🍉', t: 'melancia fruta hortifruti' },
            { e: '🥑', t: 'abacate fruta hortifruti' },
            { e: '🥕', t: 'cenoura legume hortifruti' },
            { e: '🌽', t: 'milho hortifruti' },
            { e: '🥔', t: 'batata hortifruti' },
            { e: '🍄', t: 'cogumelo hortifruti' },
            // Animais extra
            { e: '🐰', t: 'coelho pet animal' },
            { e: '🐹', t: 'hamster pet animal roedor' },
            { e: '🦜', t: 'papagaio pet ave' },
            { e: '🐢', t: 'tartaruga pet animal' },
            { e: '🐴', t: 'cavalo animal' },
            { e: '🐮', t: 'vaca animal fazenda' },
            { e: '🦴', t: 'osso pet ossos' },
            // Roupas / vestuário
            { e: '👕', t: 'camiseta camisa roupa vestuario' },
            { e: '👖', t: 'calca jeans roupa vestuario' },
            { e: '🧥', t: 'casaco jaqueta roupa vestuario' },
            { e: '🧦', t: 'meia roupa vestuario' },
            { e: '🧢', t: 'bone chapeu vestuario acessorio' },
            { e: '👒', t: 'chapeu vestuario acessorio' },
            { e: '🧤', t: 'luva vestuario acessorio' },
            { e: '🧣', t: 'cachecol vestuario acessorio' },
            { e: '👟', t: 'tenis sapato calcado' },
            { e: '🥾', t: 'bota calcado' },
            { e: '🩴', t: 'chinelo calcado' },
            // Beleza / cuidados pessoais
            { e: '💇', t: 'cabelo cabeleireiro corte beleza' },
            { e: '💈', t: 'barbeiro barbearia cabelo' },
            { e: '💆', t: 'massagem spa relaxamento bem estar' },
            { e: '🪒', t: 'lamina barbear cuidados' },
            { e: '🪥', t: 'escova dente higiene' },
            { e: '🧼', t: 'sabonete higiene limpeza' },
            { e: '🧴', t: 'cosmetico locao creme produto' },
            // Casa / utilidades
            { e: '🛏️', t: 'cama dormir movel' },
            { e: '🪑', t: 'cadeira movel' },
            { e: '🚪', t: 'porta casa' },
            { e: '💡', t: 'lampada luz energia' },
            { e: '🔌', t: 'tomada energia eletrico' },
            { e: '🔋', t: 'bateria energia pilha' },
            { e: '🧯', t: 'extintor seguranca' },
            { e: '🗑️', t: 'lixo lixeira faxina' },
            { e: '🧻', t: 'papel higienico bobina' },
            { e: '♨️', t: 'aquecimento gas energia' },
            // Tech / eletrônicos
            { e: '⌚', t: 'relogio smartwatch tech' },
            { e: '🎧', t: 'fone headphone audio tech' },
            { e: '📷', t: 'camera fotografia foto' },
            { e: '📹', t: 'camera filmadora video' },
            { e: '📺', t: 'tv televisao streaming' },
            { e: '💾', t: 'software armazenamento dados' },
            { e: '🕹️', t: 'joystick console games' },
            { e: '🎤', t: 'microfone karaoke audio' },
            // Trabalho / escritório
            { e: '📂', t: 'pasta arquivo escritorio' },
            { e: '📁', t: 'pasta arquivo escritorio documento' },
            { e: '📄', t: 'documento papel folha trabalho' },
            { e: '📰', t: 'jornal noticia assinatura' },
            { e: '📎', t: 'clipe escritorio papelaria' },
            { e: '✂️', t: 'tesoura papelaria escritorio' },
            { e: '🗓️', t: 'calendario agenda' },
            // Transporte adicional
            { e: '🚙', t: 'suv carro veiculo' },
            { e: '🚐', t: 'van veiculo' },
            { e: '🚚', t: 'caminhao frete entrega' },
            { e: '🛻', t: 'caminhonete pickup veiculo' },
            { e: '🚓', t: 'policia multa carro' },
            { e: '🚑', t: 'ambulancia saude' },
            { e: '🚒', t: 'bombeiro' },
            { e: '🚦', t: 'semaforo transito' },
            // Festas / celebrações
            { e: '🎂', t: 'bolo aniversario festa' },
            { e: '🎉', t: 'festa comemoracao' },
            { e: '🎊', t: 'festa confete comemoracao' },
            { e: '🥳', t: 'festa comemoracao aniversario' },
            { e: '🎄', t: 'natal arvore festa' },
            { e: '🎃', t: 'halloween festa' },
            { e: '🥂', t: 'brinde tacas festa comemoracao' },
            { e: '🎆', t: 'fogos festa pirotecnia' },
            // Esportes adicionais
            { e: '🏈', t: 'futebol americano esporte' },
            { e: '⚾', t: 'beisebol esporte' },
            { e: '🏐', t: 'volei esporte bola' },
            { e: '🏉', t: 'rugby esporte' },
            { e: '🎱', t: 'sinuca bilhar lazer' },
            { e: '🏓', t: 'pingue pongue ping pong esporte' },
            { e: '🥊', t: 'boxe luva esporte' },
            { e: '⛳', t: 'golfe esporte' },
            { e: '⛸️', t: 'patinacao gelo esporte' },
            // Natureza / plantas
            { e: '🌷', t: 'tulipa flor planta' },
            { e: '🌸', t: 'flor sakura natureza' },
            { e: '🌼', t: 'margarida flor' },
            { e: '💐', t: 'buque flores presente' },
            { e: '🌱', t: 'broto muda planta' },
            { e: '🌳', t: 'arvore natureza' },
            { e: '🌲', t: 'pinheiro arvore natureza' },
            // Símbolos / símbolos
            { e: '❤️', t: 'coracao amor favorito' },
            { e: '🏆', t: 'trofeu premio conquista' },
            { e: '🏅', t: 'medalha premio' },
            { e: '🙏', t: 'oracao agradecimento religiao' },
            { e: '⛪', t: 'igreja religiao dizimo' },
            { e: '⚙️', t: 'engrenagem configuracao tools' },
            { e: '🔍', t: 'lupa busca pesquisa' },
            { e: '📍', t: 'pin localizacao mapa' },
            { e: '🧰', t: 'caixa ferramentas manutencao' },
            { e: '🔨', t: 'martelo ferramenta construcao' },
        ]
        // Mantém compatibilidade com _selectRenameEmoji (recebe só o caractere)
        this._catRenameEmojis = EMOJIS

        const esc = Renderer.esc.bind(Renderer)
        const mkBtn = ({ e }) => `<button class="emoji-pick-btn${e === currentEmoji ? ' selected' : ''}" onclick="app._selectRenameEmoji('${e}')" data-emoji="${e}">${e}</button>`
        const visible = EMOJIS.slice(0, 32).map(mkBtn).join('')
        const hidden = EMOJIS.slice(32).map(mkBtn).join('')
        const grid = `<div id="emoji-grid-default" style="display:contents">${visible}<div id="emoji-extra" style="display:none">${hidden}
            <button class="emoji-more-btn" onclick="document.getElementById('emoji-extra').style.display='none';document.getElementById('emoji-more-btn').style.display='inline-flex'">− ver menos</button>
            </div><button id="emoji-more-btn" class="emoji-more-btn" onclick="document.getElementById('emoji-extra').style.display='contents';this.style.display='none'">+ ver mais</button></div>
            <div id="emoji-grid-search" style="display:none"></div>
            <div id="emoji-no-results" style="display:none;font-size:12px;color:var(--text3);text-align:center;padding:12px;width:100%">Nenhum emoji encontrado</div>`

        document.getElementById('detail-title').innerHTML = `Renomear categoria`
        document.getElementById('detail-search-wrap').style.display = 'none'
        document.getElementById('detail-body').innerHTML = `
            <div style="margin-bottom:1rem">
                <div style="font-size:12px;color:var(--text3);margin-bottom:6px;font-weight:500">NOME</div>
                <input id="cat-rename-input" class="inp" type="text" value="${esc(currentName)}"
                    oninput="app._updateRenamePreview()"
                    onfocus="this.select()"
                    style="width:100%;box-sizing:border-box;font-size:15px"
                    placeholder="Nome da categoria">
            </div>
            <div style="margin-bottom:1rem">
                <div style="font-size:12px;color:var(--text3);margin-bottom:8px;font-weight:500">ÍCONE</div>
                <input id="emoji-search" type="text" placeholder="🔍 Buscar (ex: comida, cachorro, banco)"
                    oninput="app._filterEmojis(this.value)"
                    style="width:100%;box-sizing:border-box;padding:8px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;color:var(--text);background:var(--surface);outline:none;margin-bottom:10px;transition:border-color .15s"
                    onfocus="this.style.borderColor='#0ea5e9'" onblur="this.style.borderColor=''">
                <div class="emoji-grid">${grid}</div>
            </div>
            <div id="cat-rename-preview" class="cat-rename-preview">${currentEmoji} ${esc(currentName)}</div>
            <div style="margin-top:1.25rem">
                <button class="add-btn" style="width:100%" onclick="app._saveCategoryRename()">Salvar</button>
            </div>
            ${canDelete ? `
            <div style="margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--border)">
                <button onclick="app._confirmDeleteCategory()"
                    style="width:100%;padding:10px;background:transparent;border:1.5px solid #fca5a5;border-radius:8px;color:#ef4444;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s"
                    onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='transparent'">
                    🗑️ Excluir categoria
                </button>
            </div>` : ''}`

        document.getElementById('detail-overlay').classList.remove('hidden')
        setTimeout(() => document.getElementById('cat-rename-input')?.focus(), 80)
    },

    _filterEmojis(query) {
        const list = this._catRenameEmojis || []
        const def = document.getElementById('emoji-grid-default')
        const search = document.getElementById('emoji-grid-search')
        const noResults = document.getElementById('emoji-no-results')
        if (!def || !search || !noResults) return

        const q = query.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
        const currentEmoji = this._catRenameState?.selectedEmoji

        if (!q) {
            def.style.display = 'contents'
            search.style.display = 'none'
            search.innerHTML = ''
            noResults.style.display = 'none'
            return
        }

        const matches = list.filter(({ t }) => t.includes(q))
        def.style.display = 'none'
        if (matches.length === 0) {
            search.style.display = 'none'
            noResults.style.display = 'block'
            return
        }
        noResults.style.display = 'none'
        search.style.display = 'contents'
        search.innerHTML = matches.map(({ e }) =>
            `<button class="emoji-pick-btn${e === currentEmoji ? ' selected' : ''}" onclick="app._selectRenameEmoji('${e}')" data-emoji="${e}">${e}</button>`
        ).join('')
    },

    _selectRenameEmoji(emoji) {
        if (!this._catRenameState) return
        this._catRenameState.selectedEmoji = emoji
        document.querySelectorAll('.emoji-pick-btn').forEach(b => b.classList.toggle('selected', b.dataset.emoji === emoji))
        this._updateRenamePreview()
    },

    _updateRenamePreview() {
        const name = document.getElementById('cat-rename-input')?.value.trim() || ''
        const emoji = this._catRenameState?.selectedEmoji || '📦'
        const el = document.getElementById('cat-rename-preview')
        if (el) el.textContent = `${emoji} ${name}`
    },

    async _confirmDeleteCategory() {
        const s = this._catRenameState
        if (!s) return
        const category = s.category
        const label = CAT_LABELS[category] || category

        // Conta quantos gastos serão afetados
        const expenses = DataStore.load().expenses.filter(e => e.category === category)
        const rules = Object.entries(DataStore.getRules() || {}).filter(([, cat]) => cat === category).length
        const amountRules = Object.values(DataStore.getAmountRules() || {}).filter(c => c === category).length

        const esc = Renderer.esc.bind(Renderer)
        const total = expenses.reduce((s, e) => s + e.amount, 0)

        let detailsHtml = ''
        if (expenses.length > 0) {
            detailsHtml = `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 12px;margin-top:10px">
                <div style="font-size:12px;font-weight:600;color:#991b1b;margin-bottom:4px">⚠ ${expenses.length} gasto${expenses.length > 1 ? 's' : ''} ser${expenses.length > 1 ? 'ão' : 'á'} movido${expenses.length > 1 ? 's' : ''} para 📦 Outros</div>
                <div style="font-size:11px;color:#7f1d1d">Total afetado: <strong>${Renderer.fmt(total)}</strong></div>
            </div>`
        }
        if (rules > 0 || amountRules > 0) {
            const parts = []
            if (rules > 0) parts.push(`${rules} regra${rules > 1 ? 's' : ''} automática${rules > 1 ? 's' : ''}`)
            if (amountRules > 0) parts.push(`${amountRules} fixaç${amountRules > 1 ? 'ões' : 'ão'} de valor`)
            detailsHtml += `<div style="font-size:11px;color:var(--text3);margin-top:8px">Também serão removidas: ${parts.join(' e ')}.</div>`
        }

        const confirmed = await this._showConfirmModal({
            title: `Excluir categoria ${esc(label)}?`,
            message: `Esta ação não pode ser desfeita.${detailsHtml}`,
            confirmLabel: 'Excluir',
            dangerous: true,
        })
        if (!confirmed) return

        try {
            await ApiClient.delete(`/api/categories/${category}`)
            this._catRenameState = null
            await DataStore._loadAll()
            this._syncCustomCategories()
            this.closeDetail()
            this.render()
            setTimeout(() => this._renderOverviewChart(), 50)
            this._showToast(`Categoria removida.`, 'toast-info')
        } catch (e) {
            const msg = e?.body?.message || 'Erro ao excluir categoria.'
            this._showToast(msg, 'toast-error')
        }
    },

    async _saveCategoryRename() {
        const s = this._catRenameState
        if (!s) return
        const rawName = document.getElementById('cat-rename-input')?.value.trim()
        if (!rawName) return
        const cleanName = rawName.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]\s*/u, '').trim()
        const final = `${s.selectedEmoji} ${cleanName}`
        try {
            await DataStore.renameCategory(s.category, final)
            this._catRenameState = null
            this._syncCustomCategories()
            this.render()
            setTimeout(() => this._renderOverviewChart(), 50)
            this.closeDetail()
        } catch (e) {
            this._showToast('Erro ao renomear categoria.', 'toast-error')
        }
    },

    // ── Troca de categoria via select ─────────────────────────────────────────
    async handleCatChange(id, el, currentCat, bankArg) {
        if (el.value === '__new__') {
            const newKey = await this._createCustomCategory()
            if (newKey) {
                await this.changeExpenseCategory(id, newKey, newKey, bankArg || null)
            } else {
                const exp = DataStore.getExpenseById(id)
                el.value = exp?.category || 'outros'
            }
        } else {
            await this.changeExpenseCategory(id, el.value, currentCat, bankArg || null)
        }
    },

    // ── Pin de valor ──────────────────────────────────────────────────────────
    async pinAmountRule(id, currentCat, bankArg) {
        const expense = DataStore.getExpenseById(id)
        if (!expense) return
        const normKey = Classifier._normalizeKey(expense.name)
        const key = `${normKey}::${expense.amount.toFixed(2)}`
        const wasPinned = !!(DataStore.getAmountRules() || {})[key]
        try {
            if (wasPinned) {
                await DataStore.removeAmountRule(normKey, expense.amount)
                this._showToast('📌 Regra de valor removida', 'toast-info')
            } else {
                await DataStore.setAmountRule(normKey, expense.amount, expense.category || currentCat)
                const catLabel = CAT_LABELS[expense.category || currentCat] || currentCat
                this._showToast(`📌 Fixado! ${Renderer.fmt(expense.amount)} → ${catLabel}`, 'toast-success')
            }
        } catch (e) {
            this._showToast('Erro ao salvar regra.', 'toast-error')
        }
        this.showCategoryDetail(currentCat, bankArg || null)
    },

    // ── Alias / apelido ───────────────────────────────────────────────────────
    async editAlias(id) {
        const expense = DataStore.getExpenseById(id)
        if (!expense) return
        const key = Classifier._normalizeKey(expense.name)
        const current = DataStore.getAlias(key) || ''
        const alias = await this._showAliasModal(expense.name, current)
        if (alias === null) return
        try {
            if (alias.trim()) {
                await DataStore.setAlias(key, alias.trim())
                this._showToast('✓ Apelido salvo', 'toast-success')
            } else {
                await DataStore.removeAlias(key)
                this._showToast('Apelido removido', 'toast-info')
            }
        } catch (e) {
            this._showToast('Erro ao salvar apelido.', 'toast-error')
        }
        if (this._catDetailState) {
            this.showCategoryDetail(this._catDetailState.category, this._catDetailState.bank || null)
        }
        this.render()
    },

    editCategoryBudget(categoryKey) {
        const custom = DataStore.getCustomCategories()
        const cat = custom[categoryKey]
        const label = CAT_LABELS[categoryKey] || cat?.label || categoryKey
        const currentBudget = cat?.budget ?? null

        const html = `
          <div class="modal-header"><span>🎯 Meta de gasto — ${Renderer.esc(label)}</span></div>
          <div class="modal-body" style="display:flex;flex-direction:column;gap:14px">
            <div style="font-size:13px;color:var(--text2)">
              Defina um limite mensal para esta categoria. O app vai te avisar quando você estiver perto de ultrapassar.
            </div>
            <div>
              <label class="form-label">Limite mensal</label>
              <div style="display:flex;align-items:center;gap:0">
                <span style="padding:9px 10px;background:var(--surface2);border:1.5px solid var(--border);border-right:none;border-radius:8px 0 0 8px;font-size:13px;color:var(--text2)">R$</span>
                <input id="budget-input" class="form-input" type="number" step="0.01" min="0" placeholder="Ex: 500,00"
                  value="${currentBudget ?? ''}" style="border-radius:0 8px 8px 0">
              </div>
            </div>
            ${currentBudget ? `
            <button class="btn-danger-sm" onclick="app._removeCategoryBudget('${categoryKey}')">
              Remover meta
            </button>` : ''}
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" onclick="app._closeModal()">Cancelar</button>
            <button class="btn-primary" onclick="app._saveCategoryBudget('${categoryKey}')">Salvar meta</button>
          </div>`
        this._openModal(html)
        setTimeout(() => document.getElementById('budget-input')?.focus(), 50)
    },

    async _saveCategoryBudget(categoryKey) {
        const val = parseFloat(document.getElementById('budget-input')?.value || '0')
        if (!val || val <= 0) { this._showToast('Informe um valor válido.', 'toast-error'); return }
        try {
            await ApiClient.patch(`/api/categories/${categoryKey}`, { budget: val })
            this._closeModal()
            await DataStore._loadAll()
            await BudgetNotifier.checkAfterBudgetSave(app.currentMonth, categoryKey)
            this.render()
            this._showToast('✓ Meta salva.', 'toast-success')
        } catch {
            this._showToast('Erro ao salvar meta.', 'toast-error')
        }
    },

    async _removeCategoryBudget(categoryKey) {
        try {
            await ApiClient.patch(`/api/categories/${categoryKey}`, { budget: null })
            const custom = DataStore.getCustomCategories()
            if (custom[categoryKey]) custom[categoryKey].budget = null
            this._closeModal()
            this.render()
            this._showToast('Meta removida.', 'toast-info')
        } catch {
            this._showToast('Erro ao remover meta.', 'toast-error')
        }
    },

    _showAliasModal(rawName, currentAlias) {
        return new Promise(resolve => {
            const overlay = document.createElement('div')
            overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(2px)'

            const box = document.createElement('div')
            box.style.cssText = 'background:var(--surface);border-radius:16px;padding:24px;width:100%;max-width:360px;box-shadow:0 20px 60px rgba(0,0,0,0.25)'

            const removeRow = currentAlias
                ? `<button id="_alias_remove" style="width:100%;margin-bottom:8px;padding:9px;border:1.5px solid #fca5a5;border-radius:8px;background:transparent;color:#ef4444;font-size:13px;cursor:pointer;font-weight:600">Remover apelido</button>`
                : ''

            box.innerHTML = `
                <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:6px">✏️ Criar apelido</div>
                <div style="font-size:11px;color:var(--text3);margin-bottom:20px;padding:8px 10px;background:var(--bg);border-radius:8px;word-break:break-all">${Renderer.esc(rawName)}</div>
                <label style="font-size:12px;font-weight:600;color:var(--text2);display:block;margin-bottom:6px">Apelido</label>
                <input id="_alias_input" type="text" placeholder="Ex: Barraquinha Faculdade" value="${Renderer.esc(currentAlias)}"
                    style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;color:var(--text);background:var(--surface);outline:none;margin-bottom:16px;transition:border-color .15s">
                ${removeRow}
                <div style="display:flex;gap:8px">
                    <button id="_alias_cancel" style="flex:1;padding:10px;border:1.5px solid var(--border);border-radius:8px;background:transparent;color:var(--text2);font-size:14px;cursor:pointer;font-weight:500">Cancelar</button>
                    <button id="_alias_save" style="flex:1;padding:10px;border:none;border-radius:8px;background:#0ea5e9;color:#fff;font-size:14px;font-weight:600;cursor:pointer">Salvar</button>
                </div>
            `

            overlay.appendChild(box)
            document.body.appendChild(overlay)

            const input = box.querySelector('#_alias_input')
            input.focus()
            input.select()
            input.addEventListener('focus', () => { input.style.borderColor = '#0ea5e9' })
            input.addEventListener('blur', () => { input.style.borderColor = '' })

            const close = (val) => { document.body.removeChild(overlay); resolve(val) }

            overlay.addEventListener('click', e => { if (e.target === overlay) close(null) })
            box.querySelector('#_alias_cancel').addEventListener('click', () => close(null))
            box.querySelector('#_alias_save').addEventListener('click', () => close(input.value))
            if (currentAlias) box.querySelector('#_alias_remove').addEventListener('click', () => close(''))
            input.addEventListener('keydown', e => {
                if (e.key === 'Enter') close(input.value)
                if (e.key === 'Escape') close(null)
            })
        })
    },
})
