const resourceKey = (policyId, scopeId) => scopeId ? `${policyId}:${scopeId}` : policyId

export function createPrintingSettingsAdapter({ policyEditing, printing, stationId } = {}) {
  const activeStationId = () => stationId || printing?.localStation?.id || ''
  const stateOf = (policyId, scopeId) => policyEditing?.resources?.[resourceKey(policyId, scopeId)] ?? null
  const stationAction = (action) => {
    const id = activeStationId()
    return id ? action(id) : false
  }

  return {
    policyState: () => stateOf('printingPolicy'),
    stationState: () => stateOf('stationConfiguration', activeStationId()),
    primaryState: () => stateOf('stationPrimary'),
    loadPolicy: () => policyEditing?.load?.('printingPolicy') ?? false,
    reloadPolicy: () => policyEditing?.load?.('printingPolicy') ?? false,
    reviewPolicy: () => policyEditing?.reviewConflict?.('printingPolicy') ?? null,
    editPolicy: (data) => policyEditing?.edit?.('printingPolicy', data) ?? false,
    savePolicy: () => policyEditing?.save?.('printingPolicy') ?? false,
    discardPolicy: () => policyEditing?.discard?.('printingPolicy') ?? false,
    reconcilePolicy: () => policyEditing?.reconcile?.('printingPolicy') ?? false,
    loadStation: () => stationAction((id) => Promise.all([
      policyEditing?.load?.('stationConfiguration', id) ?? false,
      policyEditing?.load?.('stationPrimary') ?? false,
    ])),
    reloadStation: () => stationAction((id) => policyEditing?.load?.('stationConfiguration', id) ?? false),
    reviewStation: () => stationAction((id) => policyEditing?.reviewConflict?.('stationConfiguration', id) ?? null),
    reviewPrimary: () => policyEditing?.reviewConflict?.('stationPrimary') ?? null,
    editStation: (data) => stationAction((id) => policyEditing?.edit?.('stationConfiguration', data, id) ?? false),
    saveStation: () => stationAction((id) => policyEditing?.save?.('stationConfiguration', id) ?? false),
    discardStation: () => stationAction((id) => policyEditing?.discard?.('stationConfiguration', id) ?? false),
    reconcileStation: () => stationAction((id) => policyEditing?.reconcile?.('stationConfiguration', id) ?? false),
    makePrimary: async () => stationAction(async (id) => {
      if (!policyEditing?.edit?.('stationPrimary', { primaryStationId: id })) return false
      return policyEditing.save?.('stationPrimary') ?? false
    }),
    savePrinter: (name) => printing?.selectPrinter?.(name) ?? false,
    refreshPrinters: () => printing?.refreshPrinters?.() ?? false,
    testPrint: () => printing?.testPrint?.() ?? false,
  }
}
