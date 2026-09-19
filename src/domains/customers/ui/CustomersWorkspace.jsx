import { useMemo } from 'react'
import { useCustomerCommands } from '../application/useCustomerCommands.js'
import { useCustomerEditor } from '../application/useCustomerEditor.js'
import { filterAndSortClients } from '../domain/clientList.js'
import ClientDuplicateModal from './ClientDuplicateModal.jsx'
import Clients from './Clients.jsx'
import CustomerEditorDialog from './CustomerEditorDialog.jsx'

function CustomersWorkspace({
  clients = [],
  search = '',
  sort = 'name-asc',
  onSearchChange = () => {},
  onSortChange = () => {},
  writesBlocked = false,
  canManageClients = false,
  applyOfficialEffects = () => {},
  setRequestKey = () => {},
  onSuccess = () => {},
  onError = () => {},
  onDuplicatePhone = () => {},
}) {
  const commands = useCustomerCommands({
    writesBlocked,
    canManageClients,
    applyOfficialEffects,
    setRequestKey,
    onSuccess,
    onError,
  })
  const editor = useCustomerEditor({
    clients,
    canManageClients,
    writesBlocked,
    createClient: commands.createClient,
    updateClient: commands.updateClient,
    onDuplicatePhone,
    onUseExistingClient: (existing) => {
      if (existing?.name) onSearchChange(existing.name)
    },
  })
  const visibleClients = useMemo(
    () => filterAndSortClients(clients, { search, sort }),
    [clients, search, sort],
  )

  const handleDeleteClient = async (clientId) => {
    if (!canManageClients || writesBlocked) return false
    const deleted = await commands.deleteClient(clientId)
    if (!deleted) return false
    editor.closeIfEditing(clientId)
    return true
  }

  return (
    <>
      <Clients
        clients={visibleClients}
        search={search}
        sort={sort}
        onSearchChange={onSearchChange}
        onSortChange={onSortChange}
        onAdd={editor.openNewClient}
        onEdit={editor.editClient}
        onDelete={handleDeleteClient}
        canManageClients={canManageClients}
      />
      {canManageClients && (
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
      {canManageClients && editor.duplicateDialog && (
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
