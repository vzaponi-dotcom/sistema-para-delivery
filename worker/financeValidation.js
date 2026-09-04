import { getBusinessDate, isManualMovementCategory } from '../shared/finance.js'
import {
  moneyToCents,
  requireNonEmpty,
  signedMoneyToCents,
  validateIsoDate,
  validateMovementType,
  validatePaymentMethod,
} from './validation.js'

const financeValidationError = (field, message) => Object.assign(new Error(message), {
  status: 400,
  code: 'VALIDATION_ERROR',
  field,
})

const validateNotFuture = (date, field, now) => {
  if (date > getBusinessDate(now)) throw financeValidationError(field, 'A data não pode estar no futuro.')
  return date
}

export const parseManualMovementInput = (body = {}, now = new Date()) => {
  const type = validateMovementType(body.type)
  const category = requireNonEmpty(body.category, 'category')
  if (!isManualMovementCategory(type, category)) {
    throw financeValidationError('category', 'Selecione uma categoria manual compatível com o tipo do movimento.')
  }
  const valueCents = moneyToCents(body.value, 'value')
  if (valueCents <= 0) throw financeValidationError('value', 'O valor deve ser maior que zero.')
  const movementDate = validateNotFuture(validateIsoDate(body.movementDate, 'movementDate'), 'movementDate', now)
  return {
    type,
    category,
    description: requireNonEmpty(body.description, 'description'),
    valueCents,
    movementDate,
    paymentMethod: validatePaymentMethod(body.paymentMethod, 'paymentMethod'),
  }
}

export const parseFinanceSettingsInput = (body = {}, now = new Date()) => ({
  openingBalanceCents: signedMoneyToCents(body.openingBalance, 'openingBalance'),
  openingDate: validateNotFuture(validateIsoDate(body.openingDate, 'openingDate'), 'openingDate', now),
})
