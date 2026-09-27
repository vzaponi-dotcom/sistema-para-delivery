export const SYSTEM_NOTIFICATIONS = Object.freeze([
  Object.freeze({
    id: 'release-2026-09-receivables-client-batching',
    type: 'release',
    publishedAt: '2026-09-27T20:30:00-03:00',
    title: 'A Receber por cliente',
    summary: 'Agora você pode agrupar as pendências do mesmo cliente, selecionar vários pedidos e registrar o recebimento em uma única operação.',
    items: Object.freeze([
      Object.freeze({
        icon: 'clients',
        title: 'Pendências agrupadas por cliente',
        description: 'No modo Por cliente, os pedidos em aberto ficam reunidos para você enxergar quantidade e total com mais clareza.',
      }),
      Object.freeze({
        icon: 'orders',
        title: 'Escolha quais pedidos receber',
        description: 'Expanda o cliente e selecione somente os pedidos que serão pagos naquele momento.',
      }),
      Object.freeze({
        icon: 'receipt',
        title: 'Baixe vários pedidos de uma vez',
        description: 'Registre o recebimento dos pedidos selecionados em um único fluxo, mantendo cada pedido quitado corretamente.',
      }),
    ]),
  }),
  Object.freeze({
    id: 'release-2026-09-reporting-center',
    type: 'release',
    publishedAt: '2026-09-26T18:30:00-03:00',
    title: 'Nova Central de Relatórios',
    summary: 'Relatórios completos para desktop com visão geral, operação, vendas, produtos, detalhado e exportações em Excel, CSV e PDF executivo.',
    slides: Object.freeze([
      Object.freeze({
        icon: 'layout',
        title: 'Nova Central de Relatórios',
        description: 'Acompanhe a operação com mais clareza em uma experiência completa disponível somente na versão desktop.',
        image: '/release/reporting-center-1.webp',
        imageAlt: 'Slide de apresentação da nova Central de Relatórios da Mesiva, destacando que está disponível somente no desktop',
        imagePosition: 'center',
      }),
      Object.freeze({
        icon: 'navigation',
        title: 'Operação e vendas com mais contexto',
        description: 'Entenda desempenho, prazos, recebimentos e evolução com indicadores e gráficos claros.',
        image: '/release/reporting-center-2.webp',
        imageAlt: 'Slide com as telas reais de Operação e Vendas da Central de Relatórios no desktop',
        imagePosition: 'center',
      }),
      Object.freeze({
        icon: 'realtime',
        title: 'Produtos que puxam resultado',
        description: 'Acompanhe Top 10, receita por categoria, mix e ranking completo para entender o que mais gera resultado.',
        image: '/release/reporting-center-3.webp',
        imageAlt: 'Slide com a tela real de Produtos, Top 10, receita e mix por categoria',
        imagePosition: 'center',
      }),
      Object.freeze({
        icon: 'clipboard',
        title: 'Do consolidado ao detalhe',
        description: 'Filtre pedidos, abra o drawer e investigue cliente, histórico e financeiro sem sair do relatório.',
        image: '/release/reporting-center-4.webp',
        imageAlt: 'Slide com a tabela de pedidos detalhados e o drawer real de um pedido aberto',
        imagePosition: 'center',
      }),
      Object.freeze({
        icon: 'notes',
        title: 'Exporte e compartilhe',
        description: 'Baixe Excel, CSV e PDF executivo para análises, apresentações e compartilhamento.',
        image: '/release/reporting-center-5.webp',
        imageAlt: 'Slide com o menu real de exportação e a primeira página do PDF executivo',
        imagePosition: 'center',
      }),
    ]),
  }),
  Object.freeze({
    id: 'release-2026-09-kitchen-tv',
    type: 'release',
    publishedAt: '2026-09-22T22:55:00-03:00',
    title: 'Nova TV da Cozinha',
    summary: 'Uma tela dedicada para acompanhar a produção em tempo real, com pareamento simples, leitura à distância e alertas de novos pedidos.',
    slides: Object.freeze([
      Object.freeze({
        icon: 'kitchen',
        title: 'Uma tela feita para a cozinha',
        description: 'Acompanhe os pedidos em uma TV dedicada, com leitura à distância e atualização automática da operação.',
        image: '/release/kitchen-tv-32.jpg',
        imageAlt: 'Painel da TV da Cozinha com os pedidos organizados em cards',
        imagePosition: 'center',
      }),
      Object.freeze({
        icon: 'pairing',
        title: 'Conecte a TV em poucos passos',
        description: 'Abra a TV da Cozinha, veja o código de 6 dígitos e informe esse código em Configurações → TV da Cozinha.',
        image: '/release/kitchen-tv-pairing.svg',
        imageAlt: 'Ilustração do código de pareamento na TV ao lado da configuração no celular',
        imagePosition: 'center',
      }),
      Object.freeze({
        icon: 'orders',
        title: 'Pedidos legíveis à distância',
        description: 'Cliente ou mesa, tempo de preparo, modalidade e situação operacional ficam em destaque para a equipe.',
        image: '/release/kitchen-tv-32.jpg',
        imageAlt: 'Cards grandes da cozinha com cliente, tempo, modalidade e status',
        imagePosition: 'center',
      }),
      Object.freeze({
        icon: 'notes',
        title: 'Itens e observações sempre visíveis',
        description: 'Nenhum item do pedido é escondido. As observações aparecem junto do produto correspondente para facilitar o preparo.',
        image: '/release/kitchen-tv-details.svg',
        imageAlt: 'Ilustração de um pedido com produtos e observações de produção visíveis',
        imagePosition: 'center',
      }),
      Object.freeze({
        icon: 'sound',
        title: 'Alertas e acesso sob controle',
        description: 'O painel avisa sobre novos pedidos e a conexão da TV pode ser acompanhada ou revogada em Configurações → TV da Cozinha.',
        image: '/release/kitchen-tv-access.svg',
        imageAlt: 'Ilustração do painel com alerta sonoro e do controle de acesso da TV',
        imagePosition: 'center',
      }),
    ]),
  }),
  Object.freeze({
    id: 'release-2026-09-operation-shell',
    type: 'release',
    publishedAt: '2026-09-21T23:00:00-03:00',
    title: 'Novidades da Mesiva',
    summary: 'Badges de Pedidos e Comandas, Central de notificações e nova barra superior.',
    items: Object.freeze([
      Object.freeze({ icon: 'orders', title: 'Pedidos e Comandas em andamento', description: 'Os menus agora mostram quantos pedidos precisam de acompanhamento e quantas comandas estão abertas.' }),
      Object.freeze({ icon: 'notifications', title: 'Central de notificações', description: 'O novo sino reúne novidades do sistema e mantém o histórico disponível neste dispositivo.' }),
      Object.freeze({ icon: 'layout', title: 'Nova barra superior', description: 'A barra superior reúne notificações e atalhos da operação sem ocupar a área principal de trabalho.' }),
    ]),
  }),
])

export const CURRENT_RELEASE = SYSTEM_NOTIFICATIONS[0]

const validText = (value) => typeof value === 'string' && Boolean(value.trim())
const validItem = (item) => item && validText(item.icon) && validText(item.title) && validText(item.description)
const validSlide = (slide) => slide
  && validText(slide.icon)
  && validText(slide.title)
  && validText(slide.description)
  && validText(slide.image)
  && validText(slide.imageAlt)
  && (slide.imagePosition === undefined || validText(slide.imagePosition))
const validLegacySection = (section) => section && validText(section.title) && validText(section.body)

const normalizeItems = (notification) => {
  if (notification.items !== undefined) {
    if (!Array.isArray(notification.items) || !notification.items.every(validItem)) return null
    return notification.items.map(({ icon, title, description }) => ({ icon, title, description }))
  }
  if (notification.sections !== undefined) {
    if (!Array.isArray(notification.sections) || !notification.sections.every(validLegacySection)) return null
    return notification.sections.map(({ title, body }) => ({ icon: 'details', title, description: body }))
  }
  return []
}

const normalizeSlides = (notification) => {
  if (notification.slides === undefined) return []
  if (!Array.isArray(notification.slides)) return null
  if (notification.slides.length === 0) return []
  if (!notification.slides.every(validSlide)) return null
  return notification.slides.map(({ icon, title, description, image, imageAlt, imagePosition }) => ({
    icon, title, description, image, imageAlt, imagePosition: imagePosition || 'center',
  }))
}

export const normalizeNotificationCatalog = (items = []) => {
  const byId = new Map()
  for (const item of items) {
    if (!item || !validText(item.id)
      || !validText(item.title)
      || !validText(item.summary)
      || typeof item.publishedAt !== 'string' || !Number.isFinite(Date.parse(item.publishedAt))) continue
    const hasSlides = Array.isArray(item.slides) && item.slides.length > 0
    const hasItems = Array.isArray(item.items) && item.items.length > 0
    const hasSections = Array.isArray(item.sections) && item.sections.length > 0
    const declaredEmptySlidesOnly = item.slides !== undefined
      && Array.isArray(item.slides)
      && item.slides.length === 0
      && item.items === undefined
      && item.sections === undefined
    if (declaredEmptySlidesOnly || (hasSlides && (hasItems || hasSections))) continue
    const normalizedItems = normalizeItems(item)
    const normalizedSlides = normalizeSlides(item)
    if (!normalizedItems || !normalizedSlides) continue
    if (!byId.has(item.id)) byId.set(item.id, { ...item, items: normalizedItems, slides: normalizedSlides })
  }
  return [...byId.values()].sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt) || left.id.localeCompare(right.id))
}
