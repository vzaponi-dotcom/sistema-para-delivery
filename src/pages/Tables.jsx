import { useMemo, useState } from 'react'
import '../table-management.css'
import Button from '../components/Button'
import ConfirmationDialog from '../components/ConfirmationDialog'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import TableTransferDialog from '../components/TableTransferDialog'

function Tables({ tables, disabled, onCreate, onRename, onSetActive, onReorder, onTransfer }) {
  const [newName, setNewName] = useState('')
  const [editingTableId, setEditingTableId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [deactivatingTable, setDeactivatingTable] = useState(null)
  const [transferSource, setTransferSource] = useState(null)
  const orderedTables = useMemo(() => [...tables].sort((left, right) => left.sortOrder - right.sortOrder), [tables])

  const createTable = async (event) => {
    event.preventDefault()
    if (disabled || !newName.trim()) return
    const created = await onCreate(newName.trim())
    if (created) setNewName('')
  }

  const beginRename = (table) => {
    if (disabled || table.occupancy === 'occupied') return
    setEditingTableId(table.id)
    setEditingName(table.name)
  }

  const saveRename = async (event, table) => {
    event.preventDefault()
    if (disabled || !editingName.trim()) return
    const renamed = await onRename(table.id, editingName.trim())
    if (renamed) setEditingTableId(null)
  }

  const moveTable = async (index, offset) => {
    const destinationIndex = index + offset
    if (disabled || destinationIndex < 0 || destinationIndex >= orderedTables.length) return
    const next = [...orderedTables]
    ;[next[index], next[destinationIndex]] = [next[destinationIndex], next[index]]
    await onReorder(next.map((table) => table.id))
  }

  const deactivateTable = async () => {
    if (!deactivatingTable || disabled) return
    const updated = await onSetActive(deactivatingTable.id, false)
    if (updated) setDeactivatingTable(null)
  }

  return (
    <div className="tables-page">
      <PageHeader title="Mesas" description="Organize as mesas e transfira comandas abertas com segurança." />

      <section className="surface-card table-create-card">
        <form className="table-create-form" onSubmit={createTable}>
          <label className="form-field"><span>Nova mesa</span><input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Ex: Varanda 1" maxLength="60" disabled={disabled} /></label>
          <Button type="submit" icon="plus" disabled={disabled || !newName.trim()}>Nova mesa</Button>
        </form>
      </section>

      <section className="table-management-list" aria-label="Lista de mesas">
        {orderedTables.map((table, index) => {
          const occupied = table.occupancy === 'occupied'
          const editing = editingTableId === table.id
          return (
            <article className={table.isActive ? 'table-management-card' : 'table-management-card inactive'} key={table.id}>
              <div className="table-management-summary">
                {editing ? (
                  <form className="table-rename-form" onSubmit={(event) => saveRename(event, table)}>
                    <label className="form-field"><span>Nome da mesa</span><input value={editingName} onChange={(event) => setEditingName(event.target.value)} maxLength="60" autoFocus disabled={disabled} /></label>
                    <div className="table-inline-actions"><Button type="button" variant="secondary" onClick={() => setEditingTableId(null)} disabled={disabled}>Cancelar</Button><Button type="submit" disabled={disabled || !editingName.trim()}>Salvar</Button></div>
                  </form>
                ) : (
                  <><strong>{table.name}</strong><div className="table-statuses"><span className={table.isActive ? 'table-status active' : 'table-status inactive'}>{table.isActive ? 'Ativa' : 'Inativa'}</span><span className={occupied ? 'table-status occupied' : 'table-status free'}>{occupied ? 'Ocupada' : 'Livre'}</span></div></>
                )}
              </div>

              {occupied ? (
                <div className="table-occupied-actions"><p>Feche ou transfira a comanda antes de renomear/desativar.</p><Button type="button" variant="secondary" onClick={() => setTransferSource(table)} disabled={disabled}>Transferir comanda</Button></div>
              ) : (
                <div className="table-management-actions">
                  <Button type="button" variant="secondary" icon="edit" onClick={() => beginRename(table)} disabled={disabled}>Renomear mesa</Button>
                  <div className="table-order-actions">
                    <button type="button" className="icon-button" aria-label={`Mover ${table.name} para cima`} onClick={() => void moveTable(index, -1)} disabled={disabled || index === 0}><Icon name="arrow-up" size={18} /></button>
                    <button type="button" className="icon-button" aria-label={`Mover ${table.name} para baixo`} onClick={() => void moveTable(index, 1)} disabled={disabled || index === orderedTables.length - 1}><Icon name="arrow-down" size={18} /></button>
                  </div>
                  {table.isActive ? <Button type="button" variant="danger" onClick={() => setDeactivatingTable(table)} disabled={disabled}>Desativar mesa</Button> : <Button type="button" onClick={() => void onSetActive(table.id, true)} disabled={disabled}>Reativar mesa</Button>}
                </div>
              )}
            </article>
          )
        })}
        {!orderedTables.length && <div className="empty-state"><Icon name="table" size={28} /><strong>Nenhuma mesa cadastrada</strong><span>Cadastre a primeira mesa para iniciar a operação.</span></div>}
      </section>

      {deactivatingTable && <ConfirmationDialog title="Confirmar desativação" message={`Desativar ${deactivatingTable.name}? Ela continuará disponível para reativação e no histórico.`} confirmLabel="Desativar mesa" onClose={() => setDeactivatingTable(null)} onConfirm={deactivateTable} disabled={disabled} />}
      {transferSource && <TableTransferDialog sourceTable={transferSource} tables={tables} disabled={disabled} onClose={() => setTransferSource(null)} onTransfer={onTransfer} />}
    </div>
  )
}

export default Tables
