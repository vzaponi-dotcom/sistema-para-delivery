export const SYSTEM_NOTIFICATIONS = Object.freeze([
  Object.freeze({
    id: 'release-2026-09-operation-shell',
    type: 'release',
    publishedAt: '2026-09-21T23:00:00-03:00',
    title: 'Novidades do Gestão Delivery',
    summary: 'Badges de Pedidos e Comandas, Central de notificações e nova barra superior.',
    sections: Object.freeze([
      Object.freeze({ title: 'Pedidos e Comandas em andamento', body: 'Os menus agora mostram quantos pedidos precisam de acompanhamento e quantas comandas estão abertas.' }),
      Object.freeze({ title: 'Central de notificações', body: 'O novo sino reúne novidades do sistema e mantém o histórico disponível neste dispositivo.' }),
      Object.freeze({ title: 'Nova barra superior', body: 'A barra superior reúne notificações e atalhos da operação sem ocupar a área principal de trabalho.' }),
    ]),
  }),
])

export const CURRENT_RELEASE = SYSTEM_NOTIFICATIONS[0]

export const normalizeNotificationCatalog = (items = []) => {
  const byId = new Map()
  for (const item of items) {
    if (!item || typeof item.id !== 'string' || !item.id.trim()
      || typeof item.title !== 'string' || !item.title.trim()
      || typeof item.summary !== 'string' || !item.summary.trim()
      || typeof item.publishedAt !== 'string' || !Number.isFinite(Date.parse(item.publishedAt))) continue
    if (item.sections !== undefined && (!Array.isArray(item.sections) || !item.sections.every((section) => section
      && typeof section.title === 'string' && section.title.trim()
      && typeof section.body === 'string' && section.body.trim()))) continue
    if (!byId.has(item.id)) byId.set(item.id, item)
  }
  return [...byId.values()].sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt) || left.id.localeCompare(right.id))
}
