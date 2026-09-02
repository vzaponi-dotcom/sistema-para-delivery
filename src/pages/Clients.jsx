import { useState } from 'react'
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
  const writeDisabled = typeof navigator !== 'undefined' && !navigator.onLine
  const actionsDisabled = writeDisabled || pendingId !== null

  const handleDelete = async (clientId) => {
    if (actionsDisabled) return
    setPendingId(clientId)
    try {
      await onDelete(clientId)
    } finally {
      setPendingId(null)
    }
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

        <div className="entity-list">
          {clients.map((client) => (
            <article className="entity-row" key={client.id}>
              <div className="entity-avatar">{client.name.charAt(0).toUpperCase()}</div>
              <div className="entity-main">
                <strong>{client.name}</strong>
                <span>{client.phone}</span>
                <small>{client.address}</small>
              </div>
              <div className="entity-actions">
                <button type="button" className="icon-button icon-button-neutral" aria-label={`Editar ${client.name}`} title="Editar cliente" onClick={() => onEdit(client)} disabled={actionsDisabled}>
                  <Icon name="edit" size={17} />
                </button>
                <button type="button" className="icon-button icon-button-danger" aria-label={`Excluir ${client.name}`} title="Excluir cliente" onClick={() => handleDelete(client.id)} disabled={actionsDisabled}>
                  <Icon name="trash" size={17} />
                </button>
              </div>
            </article>
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
    </>
  )
}

export default Clients