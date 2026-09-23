export const SYSTEM_NOTIFICATIONS = Object.freeze([
  Object.freeze({
    id: 'release-2026-09-kitchen-tv',
    type: 'release',
    publishedAt: '2026-09-22T22:55:00-03:00',
    title: 'Nova TV da Cozinha',
    summary: 'Uma tela dedicada para acompanhar a produção em tempo real, com pareamento simples, leitura à distância e alertas de novos pedidos.',
    items: Object.freeze([
      Object.freeze({ icon: 'kitchen', title: 'Uma tela feita para a cozinha', description: 'A TV mostra somente as informações importantes para o preparo, sem menus administrativos, valores, pagamentos ou dados desnecessários para a operação.' }),
      Object.freeze({ icon: 'pairing', title: 'Conecte a TV em poucos passos', description: 'Abra a TV da Cozinha, veja o código de 6 dígitos e informe esse código em Configurações → TV da Cozinha. Depois do pareamento, a TV permanece vinculada ao negócio.' }),
      Object.freeze({ icon: 'orders', title: 'Pedidos legíveis à distância', description: 'Cliente ou mesa, tempo de preparo, modalidade e situação operacional aparecem em cards grandes, com destaque para pedidos atrasados, próximos do limite e agendados.' }),
      Object.freeze({ icon: 'notes', title: 'Todos os produtos e observações visíveis', description: 'Nenhum produto do pedido é escondido. Observações de produção aparecem diretamente abaixo do item correspondente para reduzir dúvidas e erros durante o preparo.' }),
      Object.freeze({ icon: 'realtime', title: 'Fila atualizada automaticamente', description: 'Novos pedidos entram na tela em poucos segundos, pedidos finalizados ou cancelados saem da fila e os agendados acompanham a janela de preparo configurada no sistema.' }),
      Object.freeze({ icon: 'sound', title: 'Alertas sonoros para novos pedidos', description: 'Ao iniciar o painel da cozinha, o navegador libera os alertas sonoros para avisar a equipe sempre que um novo pedido chega à operação.' }),
      Object.freeze({ icon: 'security', title: 'Acesso controlado e revogável', description: 'A TV usa uma sessão própria e somente leitura. O acesso pode ser acompanhado ou revogado a qualquer momento em Configurações → TV da Cozinha.' }),
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

export const normalizeNotificationCatalog = (items = []) => {
  const byId = new Map()
  for (const item of items) {
    if (!item || !validText(item.id)
      || !validText(item.title)
      || !validText(item.summary)
      || typeof item.publishedAt !== 'string' || !Number.isFinite(Date.parse(item.publishedAt))) continue
    const normalizedItems = normalizeItems(item)
    if (!normalizedItems) continue
    if (!byId.has(item.id)) byId.set(item.id, { ...item, items: normalizedItems })
  }
  return [...byId.values()].sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt) || left.id.localeCompare(right.id))
}
