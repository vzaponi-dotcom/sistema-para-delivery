import { getBusinessDate } from './finance.js'
import { getOperationalStartAt } from './orderTiming.js'
import { parsePrintingPolicy } from './businessPolicies.js'

const invalidCopies = () => Object.assign(new Error('A quantidade de cópias deve ser 1 ou 2.'), {
  status: 400,
  code: 'INVALID_PRINT_COPIES',
})

export const resolvePrintCopies = ({
  jobType,
  customerIdentityType,
  tableTabId,
  explicitCopies,
  policy,
} = {}) => {
  if (jobType === 'test') return 1
  if (explicitCopies !== undefined) {
    if (!Number.isInteger(explicitCopies) || ![1, 2].includes(explicitCopies)) throw invalidCopies()
    return explicitCopies
  }
  const validatedPolicy = parsePrintingPolicy(policy)
  return jobType === 'table-tab' || customerIdentityType === 'table' || Boolean(tableTabId)
    ? validatedPolicy.tableTabDefaultCopies
    : validatedPolicy.orderDefaultCopies
}


export const resolveAutomaticOrderPrintAvailableAt = ({
  type,
  customerIdentityType,
  orderDate,
  createdAt,
  scheduledFor,
} = {}, currentTiming) => {
  const created = new Date(createdAt)
  if (Number.isNaN(created.getTime())) return String(createdAt || '')
  const createdIso = created.toISOString()
  if (!scheduledFor) return createdIso

  const localReservation = type === 'Local' && customerIdentityType === 'table'
  const sameBusinessDay = orderDate === getBusinessDate(created)
  if (!localReservation && sameBusinessDay) return createdIso

  const operationalStart = getOperationalStartAt({
    createdAt: createdIso,
    scheduledFor,
  }, currentTiming)
  return operationalStart?.toISOString() || createdIso
}
