export const SYSTEM_NOTIFICATIONS = Object.freeze([
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
