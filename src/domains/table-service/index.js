export {
  getActiveTables,
  isActiveTable,
  isFreeTable,
  isOccupiedTable,
  orderTables,
} from './domain/tables.js'
export {
  findOpenTableByTabId,
  reconcileComandaSelection,
  resolveOpenComanda,
  sameComandaIdentity,
} from './domain/comandaIdentity.js'
export {
  getTransferDestinations,
  validateTransferIntent,
} from './domain/tableTransfer.js'
