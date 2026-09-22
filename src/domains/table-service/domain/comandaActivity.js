import { isOccupiedTable } from './tables.js'

export const getOpenComandaCount = (tables = [], tableTabs = []) => {
  const tabStatus = new Map(tableTabs.filter((tab) => tab?.id).map((tab) => [String(tab.id), tab.status]))
  const openIds = new Set()
  for (const table of tables) {
    if (!isOccupiedTable(table)) continue
    const tabId = String(table.openTableTab.id)
    if (tabStatus.has(tabId) && tabStatus.get(tabId) !== 'open') continue
    openIds.add(tabId)
  }
  return openIds.size
}
