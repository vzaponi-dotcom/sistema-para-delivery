const PAYMENT_METHODS = new Set([
  'Pix',
  'Dinheiro',
  'Cartão de débito',
  'Cartão de crédito',
  'Transferência',
  'Outro',
])

const ORDER_TYPES = new Set(['Entrega', 'Retirada', 'Local'])
const MOVEMENT_TYPES = new Set(['entrada', 'saida'])

const validationError = (field, message) => Object.assign(new Error(message), {
  status: 400,
  code: 'VALIDATION_ERROR',
  field,
})

export const moneyToCents = (value, field = 'value') => {
  if (typeof value === 'string' && value.trim() === '') throw validationError(field, 'Informe um valor válido.')
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) throw validationError(field, 'Informe um valor válido e não negativo.')
  return Math.round((number + Number.EPSILON) * 100)
}

export const centsToMoney = (value) => {
  const cents = Number(value)
  if (!Number.isFinite(cents)) return 0
  return cents / 100
}

export const requireNonEmpty = (value, field = 'value') => {
  if (typeof value !== 'string' || !value.trim()) throw validationError(field, `O campo ${field} é obrigatório.`)
  return value.trim()
}

export const optionalText = (value) => typeof value === 'string' ? value.trim() : ''

export const optionalTextMax = (value, maxLength, field = 'value') => {
  const text = optionalText(value)
  if (text.length > maxLength) throw validationError(field, `O campo ${field} aceita no máximo ${maxLength} caracteres.`)
  return text
}

export const validateOrderType = (value) => {
  if (!ORDER_TYPES.has(value)) throw validationError('type', 'Tipo de pedido inválido.')
  return value
}

export const validatePaymentMethod = (value) => {
  if (!PAYMENT_METHODS.has(value)) throw validationError('method', 'Forma de pagamento inválida.')
  return value
}

export const validateIsoDate = (value, field = 'date') => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw validationError(field, 'Informe uma data válida.')
  }
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw validationError(field, 'Informe uma data válida.')
  }
  return value
}

export const validatePositiveInteger = (value, field = 'quantity') => {
  const number = Number(value)
  if (!Number.isInteger(number) || number < 1) throw validationError(field, 'Informe um número inteiro maior ou igual a 1.')
  return number
}

export const validateMovementType = (value) => {
  if (!MOVEMENT_TYPES.has(value)) throw validationError('type', 'Tipo de movimentação inválido.')
  return value
}
