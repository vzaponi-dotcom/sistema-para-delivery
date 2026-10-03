export function decideSessionExit({ contextChangePending, credentialChangePending, checkoutPending, paymentPending, printPending, dirtyOrder, policyDraft } = {}) {
  if (contextChangePending || credentialChangePending || checkoutPending || paymentPending || printPending) return 'blocked'
  if (dirtyOrder) return 'confirm-order'
  if (policyDraft?.dirty) return 'confirm-policy'
  return 'exit'
}
