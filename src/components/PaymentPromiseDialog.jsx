import { useEffect, useState } from 'react'
import Button from './Button'
import Modal from './Modal'

const isRealDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function PaymentPromiseDialog({ order, today, disabled = false, onSave, onClose }) {
  const [selectedDate, setSelectedDate] = useState(order?.promisedPaymentDate || '')
  const [error, setError] = useState('')

  useEffect(() => {
    setSelectedDate(order?.promisedPaymentDate || '')
    setError('')
  }, [order])

  if (!order) return null

  const removalMakesOverdue = Boolean(order.promisedPaymentDate && order.orderDate && order.orderDate < today)

  const save = async () => {
    if (disabled) return
    if (!isRealDate(selectedDate) || selectedDate < today) {
      setError('Escolha hoje ou uma data futura.')
      return
    }
    const success = await onSave?.(order.id, selectedDate)
    if (success !== false) onClose()
  }

  const remove = async () => {
    if (disabled) return
    const success = await onSave?.(order.id, null)
    if (success !== false) onClose()
  }

  return (
    <Modal
      title="Data prometida de pagamento"
      onClose={onClose}
      footer={(
        <>
          {order.promisedPaymentDate && (
            <Button type="button" variant="secondary" onClick={remove} disabled={disabled}>
              Remover data prometida
            </Button>
          )}
          <Button type="button" onClick={save} disabled={disabled || !selectedDate}>
            Salvar data
          </Button>
        </>
      )}
    >
      <div className="payment-promise-dialog">
        <label className="form-field">
          <span>Data prometida</span>
          <input
            type="date"
            min={today}
            value={selectedDate}
            onChange={(event) => { setSelectedDate(event.target.value); setError('') }}
            disabled={disabled}
          />
        </label>
        <p className="payment-promise-helper">A data prometida altera apenas a previsão de recebimento. A data original do pedido continua a mesma.</p>
        {removalMakesOverdue && (
          <p className="payment-promise-warning" role="status">
            Sem a data prometida, este pedido será classificado como atrasado.
          </p>
        )}
        {error && <p className="payment-promise-error" role="alert">{error}</p>}
      </div>
    </Modal>
  )
}

export default PaymentPromiseDialog
