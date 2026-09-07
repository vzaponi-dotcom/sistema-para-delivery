import { useMemo, useState } from 'react'
import Button from './Button'
import ConfirmationDialog from './ConfirmationDialog'
import Modal from './Modal'

function TableTransferDialog({ sourceTable, tables, disabled, onClose, onTransfer }) {
  const [destinationId, setDestinationId] = useState('')
  const [confirming, setConfirming] = useState(false)
  const destinations = useMemo(
    () => tables.filter((table) => table.isActive && table.occupancy === 'free' && table.id !== sourceTable.id),
    [sourceTable.id, tables],
  )
  const destination = destinations.find((table) => table.id === destinationId) ?? null

  const confirmTransfer = async () => {
    if (!destination || disabled) return
    const transferred = await onTransfer(sourceTable.id, destination.id)
    if (transferred) onClose()
  }

  if (confirming && destination) {
    return (
      <ConfirmationDialog
        title="Confirmar transferência"
        message={`Transferir ${sourceTable.name} → ${destination.name}?`}
        confirmLabel="Transferir comanda"
        confirmVariant="primary"
        onClose={() => setConfirming(false)}
        onConfirm={confirmTransfer}
        disabled={disabled}
      />
    )
  }

  return (
    <Modal title={`Transferir comanda · ${sourceTable.name}`} onClose={onClose}>
      <div className="form-stack">
        <p>Escolha uma mesa ativa e livre para receber a comanda.</p>
        <div className="table-transfer-options" role="radiogroup" aria-label="Mesa de destino">
          {destinations.map((table) => (
            <button key={table.id} type="button" className={destinationId === table.id ? 'table-transfer-option active' : 'table-transfer-option'} role="radio" aria-checked={destinationId === table.id} onClick={() => setDestinationId(table.id)} disabled={disabled}>
              <strong>{table.name}</strong><span>Livre · Ativa</span>
            </button>
          ))}
        </div>
        {!destinations.length && <p className="table-empty-note">Não há mesas ativas e livres disponíveis para transferência.</p>}
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={disabled}>Cancelar</Button>
          <Button type="button" onClick={() => setConfirming(true)} disabled={disabled || !destination}>Continuar</Button>
        </div>
      </div>
    </Modal>
  )
}

export default TableTransferDialog
