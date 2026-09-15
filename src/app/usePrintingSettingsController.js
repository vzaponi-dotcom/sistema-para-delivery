const resourcesOf = (businessSettings) => businessSettings?.getResources?.() ?? businessSettings?.resources ?? {}
const centralState = (businessSettings, resource, scopeId) => resourcesOf(businessSettings)[scopeId ? `${resource}:${scopeId}` : resource] ?? null

export function createPrintingSettingsAdapter({ businessSettings, printing, stationId } = {}) {
  const activeStationId = () => stationId || printing?.localStation?.id || ''

  return {
    policyState: () => centralState(businessSettings, 'printingPolicy'),
    stationState: () => centralState(businessSettings, 'stationConfiguration', activeStationId()),
    primaryState: () => centralState(businessSettings, 'stationPrimary'),
    loadPolicy: () => businessSettings?.load?.('printingPolicy') ?? false,
    loadStation: () => {
      const id = activeStationId()
      if (!id) return false
      return Promise.all([
        businessSettings?.load?.('stationConfiguration', id),
        businessSettings?.load?.('stationPrimary'),
      ])
    },
    reloadPolicy: () => businessSettings?.load?.('printingPolicy') ?? false,
    reloadStation: () => {
      const id = activeStationId()
      return id ? businessSettings?.load?.('stationConfiguration', id) : false
    },
    reviewPolicy: () => businessSettings?.reviewConflict?.('printingPolicy') ?? null,
    reviewStation: () => {
      const id = activeStationId()
      return id ? businessSettings?.reviewConflict?.('stationConfiguration', id) : null
    },
    reviewPrimary: () => businessSettings?.reviewConflict?.('stationPrimary') ?? null,
    editPolicy: (data) => businessSettings?.edit?.('printingPolicy', data) ?? false,
    savePolicy: () => businessSettings?.save?.('printingPolicy') ?? false,
    discardPolicy: () => businessSettings?.discard?.('printingPolicy') ?? false,
    reconcilePolicy: () => businessSettings?.reconcile?.('printingPolicy') ?? false,
    editStation: (data) => {
      const id = activeStationId()
      return id ? businessSettings?.edit?.('stationConfiguration', data, id) : false
    },
    saveStation: () => {
      const id = activeStationId()
      return id ? businessSettings?.save?.('stationConfiguration', id) : false
    },
    discardStation: () => {
      const id = activeStationId()
      return id ? businessSettings?.discard?.('stationConfiguration', id) : false
    },
    reconcileStation: () => {
      const id = activeStationId()
      return id ? businessSettings?.reconcile?.('stationConfiguration', id) : false
    },
    makePrimary: async () => {
      const id = activeStationId()
      if (!id || !businessSettings?.edit?.('stationPrimary', { primaryStationId: id })) return false
      return businessSettings.save('stationPrimary')
    },
    savePrinter: (name) => printing?.selectPrinter?.(name) ?? false,
    refreshPrinters: () => printing?.refreshPrinters?.() ?? false,
    testPrint: () => printing?.testPrint?.() ?? false,
  }
}

export function usePrintingSettingsController(options = {}) {
  return createPrintingSettingsAdapter(options)
}
