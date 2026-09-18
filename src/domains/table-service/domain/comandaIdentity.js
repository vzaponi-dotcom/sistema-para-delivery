import { isOccupiedTable } from './tables.js'

export const sameComandaIdentity = (left, right) => (
  left?.tableId === right?.tableId
  && left?.tableTabId === right?.tableTabId
)

export const findOpenTableByTabId = (tables = [], tableTabId) => {
  if (!tableTabId) return null
  return tables.find((table) => isOccupiedTable(table) && table.openTableTab.id === tableTabId) ?? null
}

export const resolveOpenComanda = (tables = [], target) => {
  if (!target?.tableId || !target?.tableTabId) return null
  const table = tables.find((item) => item.id === target.tableId)
  if (!isOccupiedTable(table) || table.openTableTab.id !== target.tableTabId) return null
  return { tableId: table.id, tableTabId: table.openTableTab.id }
}

export const reconcileComandaSelection = (tables = [], selection) => {
  if (!selection?.tableTabId) return null
  const table = findOpenTableByTabId(tables, selection.tableTabId)
  return table ? { tableId: table.id, tableTabId: selection.tableTabId } : null
}
