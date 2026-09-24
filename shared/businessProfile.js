import { isBrazilState } from './brazilStates.js'

const invalid = (field, message = 'Dados da operação inválidos.') => {
  throw Object.assign(new Error(message), { status: 400, code: 'BUSINESS_PROFILE_INVALID', field })
}

const record = (value, field) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(field)
  return value
}

const exactKeys = (value, allowed, field = '') => {
  record(value, field)
  const accepted = new Set(allowed)
  for (const key of Object.keys(value)) {
    if (!accepted.has(key)) invalid(field ? `${field}.${key}` : key)
  }
}

const text = (value, { field, max, required = false, controlFree = false }) => {
  if (typeof value !== 'string') invalid(field)
  const normalized = value.trim()
  if (required && !normalized) invalid(field)
  if (normalized.length > max) invalid(field)
  if (controlFree && /[\u0000-\u001f\u007f]/u.test(normalized)) invalid(field)
  return normalized
}

const freeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) freeze(child)
  return Object.freeze(value)
}

export const EMPTY_BUSINESS_PROFILE = freeze({
  name: '',
  phone: '',
  address: {
    line: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    postalCode: '',
  },
})

export function parseBusinessProfile(value) {
  exactKeys(value, ['name', 'phone', 'address'])
  exactKeys(value.address, ['line', 'number', 'complement', 'neighborhood', 'city', 'state', 'postalCode'], 'address')

  const phoneInput = text(value.phone, { field: 'phone', max: 32, controlFree: true })
  const phoneDigits = phoneInput.replace(/\D/gu, '')
  if (phoneInput && (!/^[\d\s()+.\-]+$/u.test(phoneInput) || ![10, 11].includes(phoneDigits.length))) invalid('phone')
  const phone = phoneDigits.length === 10
    ? `(${phoneDigits.slice(0, 2)}) ${phoneDigits.slice(2, 6)}-${phoneDigits.slice(6)}`
    : phoneDigits.length === 11
      ? `(${phoneDigits.slice(0, 2)}) ${phoneDigits.slice(2, 7)}-${phoneDigits.slice(7)}`
      : ''

  const number = text(value.address.number, { field: 'address.number', max: 10, controlFree: true })
  if (number && !/^\d+$/u.test(number)) invalid('address.number')

  const stateInput = text(value.address.state, { field: 'address.state', max: 2, controlFree: true }).toLocaleUpperCase('pt-BR')
  if (stateInput && !isBrazilState(stateInput)) invalid('address.state')

  const postalInput = text(value.address.postalCode, { field: 'address.postalCode', max: 16, controlFree: true })
  const postalCode = postalInput.replace(/\D/gu, '')
  if (postalInput && (!/^[\d.\-\s]+$/u.test(postalInput) || postalCode.length !== 8)) invalid('address.postalCode')

  return freeze({
    name: text(value.name, { field: 'name', max: 120, required: true, controlFree: true }),
    phone,
    address: {
      line: text(value.address.line, { field: 'address.line', max: 120, controlFree: true }),
      number,
      complement: text(value.address.complement, { field: 'address.complement', max: 80, controlFree: true }),
      neighborhood: text(value.address.neighborhood, { field: 'address.neighborhood', max: 80, controlFree: true }),
      city: text(value.address.city, { field: 'address.city', max: 80, controlFree: true }),
      state: stateInput,
      postalCode,
    },
  })
}
