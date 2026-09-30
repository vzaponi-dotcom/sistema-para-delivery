export function decideSessionExit({ checkoutPending, paymentPending, printPending, dirtyOrder, policyDraft } = {}) {
  if (checkoutPending || paymentPending || printPending) return 'blocked'
  if (dirtyOrder) return 'confirm-order'
  if (policyDraft?.dirty) return 'confirm-policy'
  return 'exit'
}
