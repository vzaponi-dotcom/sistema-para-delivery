export function decideSessionExit({ credentialChangePending, checkoutPending, paymentPending, printPending, dirtyOrder, policyDraft } = {}) {
  if (credentialChangePending || checkoutPending || paymentPending || printPending) return 'blocked'
  if (dirtyOrder) return 'confirm-order'
  if (policyDraft?.dirty) return 'confirm-policy'
  return 'exit'
}
