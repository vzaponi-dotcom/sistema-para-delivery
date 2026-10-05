import './client-duplicate.css'
import { useCustomerCommands } from '../application/useCustomerCommands.js'
import { useCustomerEditor } from '../application/useCustomerEditor.js'
import ClientDuplicateModal from './ClientDuplicateModal.jsx'
import Clients from './Clients.jsx'
import CustomerEditorDialog from './CustomerEditorDialog.jsx'

function CustomersWorkspace({
  clients = [],
  orders = [],
  granted = new Set(),
  currency,
  onRegisterPayment,
  onRegisterClientOrdersPayment,
  onNewOrder,
  canReceiveOrder,
  renderOrderDetail,
  search = '',
  sort = 'name-asc',
  onSearchChange = () => {},
  onSortChange = () => {},
  writesBlocked = false,
  canCreateClients = false,
  canUpdateClients = false,
  canDeleteClients = false,
  applyOfficialEffects = () => {},
  setRequestKey = () => {},
  onSuccess = () => {},
  onError = () => {},
  onDuplicatePhone = () => {},
}) {
  const commands = useCustomerCommands({
    writesBlocked,
    canCreateClients, canUpdateClients, canDeleteClients,
    applyOfficialEffects,
    setRequestKey,
    onSuccess,
    onError,
  })
  const editor = useCustomerEditor({
    clients,
    canCreateClients, canUpdateClients,
    writesBlocked,
    createClient: commands.createClient,
    updateClient: commands.updateClient,
    onDuplicatePhone,
    onUseExistingClient: (existing) => {
      if (existing?.name) onSearchChange(existing.name)
    },
  })

  const handleDeleteClient = async (clientId) => {
    if (!canDeleteClients || writesBlocked) return false
    const deleted = await commands.deleteClient(clientId)
    if (!deleted) return false
    editor.closeIfEditing(clientId)
    return true
  }

  return (
    <>
      <Clients
        clients={clients}
        orders={orders}
        granted={granted}
        currency={currency}
        writesBlocked={writesBlocked}
        onRegisterPayment={onRegisterPayment}
        onRegisterClientOrdersPayment={onRegisterClientOrdersPayment}
        onNewOrder={onNewOrder}
        canReceiveOrder={canReceiveOrder}
        renderOrderDetail={renderOrderDetail}
        search={search}
        sort={sort}
        onSearchChange={onSearchChange}
        onSortChange={onSortChange}
        onAdd={editor.openNewClient}
        onEdit={editor.editClient}
        onDelete={handleDeleteClient}
        canCreateClients={canCreateClients}
        canUpdateClients={canUpdateClients}
        canDeleteClients={canDeleteClients}
      />
      {(editor.editing ? canUpdateClients : canCreateClients) && (
        <CustomerEditorDialog
          open={editor.isOpen}
          editing={editor.editing}
          value={editor.draft}
          onChange={editor.updateDraft}
          onSubmit={editor.submit}
          onCancel={editor.cancel}
          disabled={writesBlocked}
        />
      )}
      {(editor.editing ? canUpdateClients : canCreateClients) && editor.duplicateDialog && (
        <ClientDuplicateModal
          client={editor.duplicateDialog.client}
          onCancel={editor.dismissDuplicate}
          onUseExisting={editor.useExistingDuplicate}
          onConfirm={editor.confirmDuplicate}
          disabled={writesBlocked}
          cancelLabel="Cancelar"
          useExistingLabel="Usar cliente existente"
          confirmLabel="Cadastrar mesmo assim"
        />
      )}
    </>
  )
}

export default CustomersWorkspace
