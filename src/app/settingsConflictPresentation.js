import { paymentLabel } from '../../shared/businessPolicies.js'

const PLATFORM_LABELS = Object.freeze({
  windows: 'Windows',
  android: 'Android',
  ios: 'iPhone (iOS)',
  other: 'Outro',
})

const statusField = (feminine = false) => ({
  label: 'Status',
  format: (value) => value ? (feminine ? 'Ativa' : 'Ativo') : (feminine ? 'Inativa' : 'Inativo'),
})

const schemas = Object.freeze({
  operations: {
    fields: {
      'timing.scheduledPrepLeadMinutes': { label: 'Preparo antecipado do agendado', unit: 'min' },
      'timing.scheduledLateGraceMinutes': { label: 'Tolerância de atraso do agendado', unit: 'min' },
      'timing.immediateLateAfterMinutes': { label: 'Pedido imediato fica atrasado', unit: 'min' },
      'timing.immediateVeryLateAfterMinutes': { label: 'Pedido imediato fica muito atrasado', unit: 'min' },
      enabledModalities: { label: 'Modalidades ativas', separator: ', ', empty: 'Nenhuma' },
      defaultModality: { label: 'Modalidade padrão' },
    },
  },
  paymentMethods: {
    fields: {
      defaultMethod: { label: 'Forma de pagamento padrão', format: (value) => paymentLabel(value) || 'Forma de pagamento' },
    },
    lists: {
      methods: {
        label: 'Formas de pagamento',
        orderLabel: 'Ordem das formas de pagamento',
        itemSingular: 'Forma',
        identity: 'code',
        itemName: (value) => paymentLabel(value?.code) || 'Forma de pagamento',
        fields: {
          code: { label: 'Forma', format: (value) => paymentLabel(value) || 'Forma de pagamento' },
          active: statusField(),
        },
      },
    },
  },
  cancellationReasons: {
    lists: {
      items: {
        label: 'Motivos de cancelamento',
        orderLabel: 'Ordem dos motivos de cancelamento',
        itemSingular: 'Motivo',
        identity: 'id',
        itemName: (value) => value?.label || 'Motivo de cancelamento',
        fields: {
          label: { label: 'Nome' },
          active: statusField(),
        },
      },
    },
  },
  financeCategories: {
    lists: {
      items: {
        label: 'Categorias financeiras',
        orderLabel: 'Ordem das categorias financeiras',
        itemSingular: 'Categoria',
        identity: 'id',
        itemName: (value) => value?.label || 'Categoria financeira',
        fields: {
          label: { label: 'Nome' },
          type: {
            label: 'Tipo',
            format: (value) => value === 'entrada' ? 'Receita' : value === 'saida' ? 'Despesa' : 'Tipo atualizado',
          },
          active: statusField(true),
        },
      },
    },
  },
  printingPolicy: {
    fields: {
      orderDefaultCopies: { label: 'Vias de pedidos', format: (value) => `${value} ${Number(value) === 1 ? 'via' : 'vias'}` },
      tableTabDefaultCopies: { label: 'Vias de mesas e comandas', format: (value) => `${value} ${Number(value) === 1 ? 'via' : 'vias'}` },
    },
  },
  stationConfiguration: {
    fields: {
      name: { label: 'Nome da estação' },
      platform: { label: 'Plataforma', format: (value) => PLATFORM_LABELS[value] || 'Outra plataforma' },
      autoPrintEnabled: { label: 'Impressão automática', format: (value) => value ? 'Ativa' : 'Inativa' },
    },
  },
  stationPrimary: {
    fields: {
      primaryStationId: { label: 'Estação principal', format: () => 'Definição de estação' },
    },
  },
})

const pathKey = (segments = []) => segments
  .filter((segment) => typeof segment === 'string')
  .join('.')

const words = (value) => String(value || '')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/[._-]+/g, ' ')
  .trim()

const humanize = (value, fallback = 'Configuração') => {
  const text = words(value)
  if (!text) return fallback
  return text.charAt(0).toLocaleUpperCase('pt-BR') + text.slice(1)
}

const readAt = (root, segments = []) => {
  let cursor = root
  for (const segment of segments) {
    if (cursor == null) return undefined
    if (typeof segment === 'object') {
      if (!Array.isArray(cursor)) return undefined
      cursor = cursor.find((item) => item?.id === segment.id || item?.code === segment.id)
    } else cursor = cursor[segment]
  }
  return cursor
}

const listContext = (schema, conflict) => {
  const segments = conflict?.segments || []
  const itemIndex = segments.findIndex((segment) => typeof segment === 'object')
  const listSegments = conflict?.target?.listSegments
    || (itemIndex >= 0 ? segments.slice(0, itemIndex) : segments)
  const key = listSegments.filter((segment) => typeof segment === 'string').join('.')
  const descriptor = schema?.lists?.[key]
  const itemId = conflict?.itemId ?? (itemIndex >= 0 ? segments[itemIndex]?.id : undefined)
  return descriptor ? { descriptor, key, listSegments, itemId, itemIndex } : null
}

const findItem = (review, context) => {
  if (!context || context.itemId === undefined) return null
  for (const source of [review?.base, review?.current, review?.draft]) {
    const list = readAt(source, context.listSegments)
    if (!Array.isArray(list)) continue
    const item = list.find((candidate) => candidate?.[context.descriptor.identity] === context.itemId)
    if (item) return item
  }
  return null
}

const labelForIdentity = (review, context, identity) => {
  if (!context) return String(identity)
  for (const source of [review?.current, review?.draft, review?.base]) {
    const list = readAt(source, context.listSegments)
    if (!Array.isArray(list)) continue
    const found = list.find((item) => item?.[context.descriptor.identity] === identity)
    if (found) return context.descriptor.itemName(found)
  }
  return 'Item da configuração'
}

const formatListItem = (value, descriptor) => {
  if (!value || typeof value !== 'object') return String(value ?? '')
  const name = descriptor?.itemName?.(value) || value.label || 'Item da configuração'
  if (typeof value.active === 'boolean') {
    const feminine = descriptor?.itemSingular === 'Categoria'
    return `${name} · ${value.active ? (feminine ? 'Ativa' : 'Ativo') : (feminine ? 'Inativa' : 'Inativo')}`
  }
  return name
}

const formatValue = ({ value, exists = true, field, review, context, conflict }) => {
  if (!exists) return 'Item removido'
  if (value === null || value === undefined || value === '') return field?.empty || 'Nenhum'
  if (field?.format) return field.format(value)
  if (field?.unit && (typeof value === 'number' || typeof value === 'string')) return `${value} ${field.unit}`
  if (typeof value === 'boolean') return value ? 'Ativo' : 'Inativo'
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) {
    if (!value.length) return field?.empty || 'Nenhum'
    if (context && value.every((entry) => typeof entry === 'string' || typeof entry === 'number')) {
      return value.map((entry) => labelForIdentity(review, context, entry)).join(' → ')
    }
    if (value.every((entry) => entry && typeof entry === 'object')) {
      return value.map((entry) => formatListItem(entry, context?.descriptor)).join(' → ')
    }
    const separator = field?.separator || ' → '
    return value.map((entry) => typeof entry === 'string' || typeof entry === 'number' ? String(entry) : 'Item atualizado').join(separator)
  }
  if (typeof value === 'object') {
    if (context?.descriptor) return formatListItem(value, context.descriptor)
    if (conflict?.kind === 'protected-action') return 'Configuração protegida atualizada'
    return 'Configuração atualizada'
  }
  return 'Configuração atualizada'
}

export function describeSettingsConflict(review, conflict) {
  const schema = schemas[review?.resource] || {}
  const context = listContext(schema, conflict)
  const segments = conflict?.segments || []
  const itemSegmentIndex = segments.findIndex((segment) => typeof segment === 'object')
  const fieldKey = itemSegmentIndex >= 0
    ? segments.slice(itemSegmentIndex + 1).filter((segment) => typeof segment === 'string').join('.')
    : pathKey(segments)
  const directField = schema.fields?.[pathKey(segments)] || schema.fields?.[fieldKey]
  const itemField = context?.descriptor?.fields?.[fieldKey]
  const field = itemField || directField
  let label

  if (conflict?.kind === 'order' && context) label = context.descriptor.orderLabel
  else if (context?.itemId !== undefined) {
    const sourceItem = findItem(review, context)
    const itemName = sourceItem ? context.descriptor.itemName(sourceItem) : 'Item da configuração'
    label = field
      ? `${context.descriptor.itemSingular} “${itemName}” — ${field.label}`
      : `${context.descriptor.itemSingular} “${itemName}”`
  } else if (context) label = context.descriptor.label
  else label = field?.label || (review?.resource ? humanize(conflict?.path) : conflict?.path || 'Configuração')

  return {
    label,
    message: conflict?.message || 'Esta configuração foi alterada nos dois dispositivos.',
    current: formatValue({
      value: conflict?.current,
      exists: conflict?.currentExists,
      field,
      review,
      context,
      conflict,
    }),
    draft: formatValue({
      value: conflict?.draft,
      exists: conflict?.draftExists,
      field,
      review,
      context,
      conflict,
    }),
  }
}

export function conflictReviewSummary(review) {
  const count = review?.conflicts?.length || 0
  if (!count) return {
    title: 'Alterações compatíveis',
    description: 'As alterações feitas nos dois dispositivos podem ser combinadas automaticamente.',
    detail: 'Nenhuma escolha manual é necessária.',
  }
  return {
    title: count === 1 ? '1 diferença encontrada' : `${count} diferenças encontradas`,
    description: 'Escolha qual valor deve ser mantido em cada campo.',
    detail: '',
  }
}
