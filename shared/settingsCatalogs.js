import { MANUAL_MOVEMENT_CATEGORIES } from './finance.js'

const SETTINGS_ERROR = 'SETTINGS_INVALID'
const AUTOMATIC_FINANCE_NAMES = new Set(['vendas', 'estornos'])
const FINANCE_TYPES = new Set(['entrada', 'saida'])

const CANCELLATION_NATIVE_ITEMS = [
  { id: 'client_changed_mind', label: 'Cliente desistiu', active: true, sortOrder: 0 },
  { id: 'duplicate_order', label: 'Pedido duplicado', active: true, sortOrder: 1 },
  { id: 'product_unavailable', label: 'Produto indisponível', active: true, sortOrder: 2 },
  { id: 'entry_error', label: 'Erro no lançamento', active: true, sortOrder: 3 },
  { id: 'other', label: 'Outro', active: true, sortOrder: 4 },
]

const FINANCE_NATIVE_ITEMS = Object.entries(MANUAL_MOVEMENT_CATEGORIES).flatMap(([type, entries]) => (
  entries.map(({ value: id, label }, sortOrder) => ({ id, type, label, active: true, sortOrder }))
))

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

const immutableCatalog = (items) => deepFreeze({ items: items.map((item) => ({ ...item })) })

const invalid = (field, message = 'Catálogo inválido.') => {
  throw Object.assign(new Error(message), { status: 400, code: SETTINGS_ERROR, field })
}

const exactKeys = (value, allowed, field = '') => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(field)
  const allowedSet = new Set(allowed)
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) invalid(field ? `${field}.${key}` : key)
  }
}

const cleanText = (value, field, maxLength) => {
  if (typeof value !== 'string') invalid(field)
  const text = value.trim().replace(/\s+/gu, ' ')
  if (!text || text.length > maxLength) invalid(field)
  return text
}

const normalizedName = (value) => value
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .trim()
  .replace(/\s+/gu, ' ')
  .toLocaleLowerCase('pt-BR')

const existingItems = (existing) => {
  if (existing === undefined || existing === null) return []
  if (Array.isArray(existing)) return existing
  if (existing && typeof existing === 'object' && Array.isArray(existing.items)) return existing.items
  invalid('existing')
}

export const nativeCancellationReasons = () => immutableCatalog(CANCELLATION_NATIVE_ITEMS)
export const nativeFinanceCategories = () => immutableCatalog(FINANCE_NATIVE_ITEMS)

export const parseCatalog = (data, { kind, existing } = {}) => {
  if (kind !== 'cancellation' && kind !== 'finance') invalid('kind')
  exactKeys(data, ['items'])
  if (!Array.isArray(data.items) || data.items.length === 0) invalid('items')

  const finance = kind === 'finance'
  const previous = new Map(existingItems(existing).map((item) => [item.id, item]))
  const nativeItems = finance ? FINANCE_NATIVE_ITEMS : CANCELLATION_NATIVE_ITEMS
  const nativeById = new Map(nativeItems.map((item) => [item.id, item]))
  const seenIds = new Set()
  const seenPositions = new Set()
  const seenNames = new Set()

  const items = data.items.map((item, index) => {
    const path = `items.${index}`
    exactKeys(item, finance ? ['id', 'type', 'label', 'active', 'sortOrder'] : ['id', 'label', 'active', 'sortOrder'], path)
    const id = cleanText(item.id, `${path}.id`, 120)
    if (seenIds.has(id)) invalid('items')
    seenIds.add(id)

    const type = finance ? item.type : 'cancellation'
    if (finance && !FINANCE_TYPES.has(type)) invalid(`${path}.type`)
    if (typeof item.active !== 'boolean') invalid(`${path}.active`)
    if (!Number.isInteger(item.sortOrder) || item.sortOrder < 0) invalid(`${path}.sortOrder`)

    const positionKey = `${type}:${item.sortOrder}`
    if (seenPositions.has(positionKey)) invalid(`${path}.sortOrder`)
    seenPositions.add(positionKey)

    const label = cleanText(item.label, `${path}.label`, 80)
    const nameKey = `${type}:${normalizedName(label)}`
    if (seenNames.has(nameKey)) invalid(`${path}.label`)
    seenNames.add(nameKey)

    if (finance && AUTOMATIC_FINANCE_NAMES.has(normalizedName(label))) invalid(`${path}.label`)
    const native = nativeById.get(id)
    if (native && (label !== native.label || (finance && type !== native.type))) {
      invalid(finance && type !== native.type ? `${path}.type` : `${path}.label`)
    }
    if (!finance && id === 'other' && !item.active) invalid(`${path}.active`)

    const old = previous.get(id)
    if (finance && old && old.type !== type) invalid(`${path}.type`)

    return finance
      ? { id, type, label, active: item.active, sortOrder: item.sortOrder }
      : { id, label, active: item.active, sortOrder: item.sortOrder }
  })

  if (nativeItems.some(({ id }) => !seenIds.has(id))) invalid('items')
  return deepFreeze({ items })
}
