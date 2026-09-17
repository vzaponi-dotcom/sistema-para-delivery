export function createPolicyNavigationBridge() {
  let contract = null

  return {
    getNavigationDraft(destination) {
      return contract?.getNavigationDraft(destination) ?? null
    },
    discardNavigationDraft(resourceKey) {
      return contract?.discardNavigationDraft(resourceKey) ?? false
    },
    hasUnloadRisk() {
      return contract?.hasUnloadRisk() ?? false
    },
    connect(nextContract) {
      contract = nextContract
    },
    disconnect(currentContract) {
      if (contract === currentContract) contract = null
    },
  }
}
