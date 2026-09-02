import { useState } from 'react'
import '../clients-phonebook.css'
import BottomSheet from '../components/BottomSheet'
import Button from '../components/Button'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import SystemSelect from '../components/SystemSelect'

const SORT_OPTIONS = [
  { value: 'name-asc', label: 'Nome A–Z' },
  { value: 'name-desc', label: 'Nome Z–A' },
]

function Clients({ clients, search, sort, onSearchChange, onSortChange, onAdd, onEdit, onDelete }) {
  const [pendingId, setPendingId] = useState(null)
  const [selectedClient, setSelectedClient] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const writeDisabled = typeof navigator !== 'undefined' && !navigator.onLine
  const actionsDisabled = writeDisabled || pendingId !== null

  const closeActionSheet = () => {
    setSelectedClient(null)
    setDeleteConfirm(false)
  }

  const openActionSheet = (client) => {
    if (actionsDisabled) return
    setSelectedClient(client)
    setDeleteConfirm(false)
  }

  const handleDelete = async (clientId) => {
    if (actionsDisabled) return
    setPendingId(clientId)
    try {
      await onDelete(clientId)
    } finally {
      setPendingId(null)
    }
  }

  const handleEditSelected = () => {
    if (!selectedClient || actionsDisabled) return
    const client = selectedClient
    closeActionSheet()
    onEdit(client)
  }

  const handleConfirmedDelete = async () => {
    if (!selectedClient || actionsDisabled) return
    const clientId = selectedClient.id
    await handleDelete(clientId)
    closeActionSheet()
  }

  return (
    <>
      <PageHeader
        eyebrow="Relacionamento"
        title="Clientes"
        description="Organize seus contatos e encontre rapidamente quem já compra com você."
        actions={<Button icon="plus" onClick={onAdd} disabled={actionsDisabled}>Novo cliente</Button>}
      />

      <section className="surface-card">
        <div className="toolbar toolbar-split">
          <label className="search-control">
            <Icon name="search" size={18} />
            <input
              type="search"
              placeholder="Buscar por nome, telefone ou endereço"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </label>

          <div className="sort-control">
            <span>Ordenar</span>
            <SystemSelect value={sort} options={SORT_OPTIONS} onChange={onSortChange} label="Ordenar clientes" />
          </div>
        </div>

        <div className="client-phonebook-list">
          {clients.map((client) => (
            <button
              type="button"
              className="client-phonebook-row"
              key={client.id}
              aria-label={`Abrir ações de ${client.name}`}
              onClick={() => openActionSheet(client)}
              disabled={actionsDisabled}
            >
              <span className="client-phonebook-main">
                <strong>{client.name}</strong>
                <span>{client.phone || 'Sem telefone'}</span>
              </span>
              <span className="client-phonebook-address">{client.address || 'Sem endereço'}</span>
              <span className="client-phonebook-chevron" aria-hidden="true">›</span>
            </button>
          ))}
        </div>

        {!clients.length && (
          <div className="empty-state">
            <Icon name="clients" size={28} />
            <strong>Nenhum cliente encontrado</strong>
            <span>Cadastre um novo cliente ou ajuste a busca.</span>
          </div>
        )}
      </section>

      <BottomSheet open={Boolean(selectedClient)} title="Ações do cliente" onClose={closeActionSheet}>
        {selectedClient && (
          <>
            <div className="client-action-summary">
              <strong>{selectedClient.name}</strong>
              <span>{selectedClient.phone || 'Sem telefone'}</span>
              <small>{selectedClient.address || 'Sem endereço'}</small>
            </div>

            {!deleteConfirm ? (
              <div className="client-action-buttons">
                <Button type="button" variant="secondary" icon="edit" onClick={handleEditSelected} disabled={actionsDisabled}>Editar cliente</Button>
                <Button type="button" variant="danger" icon="trash" onClick={() => setDeleteConfirm(true)} disabled={actionsDisabled}>Excluir cliente</Button>
              </div>
            ) : (
              <div className="client-delete-confirm">
                <strong>Confirmar exclusão</strong>
                <p>Tem certeza que deseja excluir {selectedClient.name}? Esta ação não pode ser desfeita.</p>
                <div className="client-delete-confirm-actions">
                  <Button type="button" variant="secondary" onClick={() => setDeleteConfirm(false)} disabled={actionsDisabled}>Cancelar</Button>
                  <Button type="button" variant="danger" onClick={handleConfirmedDelete} disabled={actionsDisabled}>Excluir cliente</Button>
                </div>
              </div>
            )}
          </>
        )}
      </BottomSheet>
    </>
  )
}

export default Clients
