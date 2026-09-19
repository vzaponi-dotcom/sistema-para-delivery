export {
  findClientDuplicates,
  normalizeClientName,
} from './domain/clientDuplicates.js'

export { useCustomerCommands } from './application/useCustomerCommands.js'
export { useCustomerEditor } from './application/useCustomerEditor.js'

export { filterAndSortClients } from './domain/clientList.js'
export {
  ClientDuplicateModal,
  Clients,
  CustomerEditorDialog,
  CustomersWorkspace,
} from './ui/customerSurfaces.js'
