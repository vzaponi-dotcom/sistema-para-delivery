export const SYSTEM_NOTIFICATIONS = Object.freeze([
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
    title: 'Novidades do Gestão Delivery',
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
  if (!Array.isArray(notification.slides) || notification.slides.length === 0 || !notification.slides.every(validSlide)) return null
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
    if (hasSlides && (hasItems || hasSections)) continue
    const normalizedItems = normalizeItems(item)
    const normalizedSlides = normalizeSlides(item)
    if (!normalizedItems || !normalizedSlides) continue
    if (!byId.has(item.id)) byId.set(item.id, { ...item, items: normalizedItems, slides: normalizedSlides })
  }
  return [...byId.values()].sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt) || left.id.localeCompare(right.id))
}
