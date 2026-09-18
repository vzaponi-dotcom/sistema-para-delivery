import { resolveOpenComanda } from './comandaIdentity.js'
import { isFreeTable, orderTables } from './tables.js'

export const getTransferDestinations = (tables = [], sourceTableId) => orderTables(tables)
  .filter((table) => table.id !== sourceTableId && isFreeTable(table))

export const validateTransferIntent = (tables = [], {
  sourceTableId,
  destinationTableId,
  expectedTableTabId,
} = {}) => {
  const identity = resolveOpenComanda(tables, { tableId: sourceTableId, tableTabId: expectedTableTabId })
  if (!identity || !destinationTableId || destinationTableId === sourceTableId) return null
  const source = tables.find((table) => table.id === sourceTableId) ?? null
  const destination = tables.find((table) => table.id === destinationTableId) ?? null
  if (!source || !isFreeTable(destination)) return null
  return { identity, source, destination }
}
