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
