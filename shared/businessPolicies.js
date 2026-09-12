const SETTINGS_ERROR = 'SETTINGS_INVALID'
const MODALITIES = ['Entrega', 'Retirada', 'Local']

const PAYMENT_LABELS = new Map([
  ['pix', 'Pix'],
  ['cash', 'Dinheiro'],
  ['debit_card', 'Cartão de débito'],
  ['credit_card', 'Cartão de crédito'],
  ['transfer', 'Transferência'],
  ['other', 'Outro'],
])

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

const invalid = (field, message = 'Configuração inválida.') => {
  throw Object.assign(new Error(message), { status: 400, code: SETTINGS_ERROR, field })
}

const record = (value, field) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(field)
  return value
}

const exactKeys = (value, allowed, field = '') => {
  record(value, field)
  const allowedSet = new Set(allowed)
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) invalid(field ? `${field}.${key}` : key)
  }
}

const integerInRange = (value, min, max, field) => {
  if (!Number.isInteger(value) || value < min || value > max) invalid(field)
  return value
}

export const LEGACY_TIMING = deepFreeze({
  scheduledPrepLeadMinutes: 50,
  scheduledLateGraceMinutes: 15,
  immediateLateAfterMinutes: 30,
  immediateVeryLateAfterMinutes: 40,
})

export const DEFAULT_OPERATIONS = deepFreeze({
  timing: LEGACY_TIMING,
  enabledModalities: [...MODALITIES],
  defaultModality: 'Entrega',
})

export const DEFAULT_PAYMENT_METHODS = deepFreeze({
  methods: [...PAYMENT_LABELS.keys()].map((code, sortOrder) => ({ code, active: true, sortOrder })),
  defaultMethod: 'pix',
})

export const parseOperations = (data) => {
  exactKeys(data, ['timing', 'enabledModalities', 'defaultModality'])
  exactKeys(data.timing, Object.keys(LEGACY_TIMING), 'timing')

  const timing = {
    scheduledPrepLeadMinutes: integerInRange(data.timing.scheduledPrepLeadMinutes, 0, 240, 'timing.scheduledPrepLeadMinutes'),
    scheduledLateGraceMinutes: integerInRange(data.timing.scheduledLateGraceMinutes, 0, 120, 'timing.scheduledLateGraceMinutes'),
    immediateLateAfterMinutes: integerInRange(data.timing.immediateLateAfterMinutes, 1, 180, 'timing.immediateLateAfterMinutes'),
    immediateVeryLateAfterMinutes: integerInRange(data.timing.immediateVeryLateAfterMinutes, 1, 240, 'timing.immediateVeryLateAfterMinutes'),
  }
  if (timing.immediateVeryLateAfterMinutes <= timing.immediateLateAfterMinutes) {
    invalid('timing.immediateVeryLateAfterMinutes', 'Muito atrasado deve ser maior que atrasado e até 240.')
  }

  if (!Array.isArray(data.enabledModalities) || data.enabledModalities.length === 0) invalid('enabledModalities')
  const enabledModalities = [...data.enabledModalities]
  if (enabledModalities.some((value) => !MODALITIES.includes(value)) || new Set(enabledModalities).size !== enabledModalities.length) {
    invalid('enabledModalities')
  }
  if (!enabledModalities.includes(data.defaultModality)) invalid('defaultModality', 'Escolha uma modalidade padrão ativa.')

  return deepFreeze({ timing, enabledModalities, defaultModality: data.defaultModality })
}

export const parsePaymentMethods = (data) => {
  exactKeys(data, ['methods', 'defaultMethod'])
  if (!Array.isArray(data.methods) || data.methods.length !== PAYMENT_LABELS.size) invalid('methods')

  const methods = data.methods.map((item, index) => {
    const path = `methods.${index}`
    exactKeys(item, ['code', 'active', 'sortOrder'], path)
    if (!PAYMENT_LABELS.has(item.code)) invalid(`${path}.code`)
    if (typeof item.active !== 'boolean') invalid(`${path}.active`)
    integerInRange(item.sortOrder, 0, PAYMENT_LABELS.size - 1, `${path}.sortOrder`)
    return { code: item.code, active: item.active, sortOrder: item.sortOrder }
  })

  if (new Set(methods.map(({ code }) => code)).size !== PAYMENT_LABELS.size) invalid('methods')
  if (new Set(methods.map(({ sortOrder }) => sortOrder)).size !== PAYMENT_LABELS.size) invalid('methods')
  const selected = methods.find(({ code }) => code === data.defaultMethod)
  if (!selected?.active) invalid('defaultMethod', 'Escolha um padrão ativo.')

  return deepFreeze({ methods: methods.sort((a, b) => a.sortOrder - b.sortOrder), defaultMethod: data.defaultMethod })
}

export const parsePrintingPolicy = (data) => {
  exactKeys(data, ['orderDefaultCopies', 'tableTabDefaultCopies'])
  if (data.orderDefaultCopies !== 1 && data.orderDefaultCopies !== 2) invalid('orderDefaultCopies')
  if (data.tableTabDefaultCopies !== 1 && data.tableTabDefaultCopies !== 2) invalid('tableTabDefaultCopies')
  return deepFreeze({
    orderDefaultCopies: data.orderDefaultCopies,
    tableTabDefaultCopies: data.tableTabDefaultCopies,
  })
}

const PAYMENT_CODES_BY_VALUE = new Map([
  ...[...PAYMENT_LABELS].map(([code, label]) => [label, code]),
  ...[...PAYMENT_LABELS.keys()].map((code) => [code, code]),
])

export const paymentCode = (value) => PAYMENT_CODES_BY_VALUE.get(value) ?? null
export const paymentLabel = (code) => PAYMENT_LABELS.get(code) ?? null
