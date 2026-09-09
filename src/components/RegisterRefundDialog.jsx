import { useEffect, useState } from 'react'
import Button from './Button'
import Modal from './Modal'
import SystemSelect from './SystemSelect'
import { formatOrderDisplayNumber } from '../../shared/orderDisplayNumber.js'

const PAYMENT_OPTIONS = ['Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Transferência', 'Outro']
  .map((value) => ({ value, label: value }))

const currency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))

function RegisterRefundDialog({ open, order, onClose, onConfirm, submitting = false }) {
  const [refundMethod, setRefundMethod] = useState('')

  useEffect(() => {
    if (!open || !order) return
    setRefundMethod(order?.paymentMethod || '')
  }, [open, order])

  if (!open || !order) return null

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!refundMethod || submitting) return
    await onConfirm?.({ refundMethod })
  }

  const amount = Number(order.paidAmount || order.total || 0)

  return (
    <Modal title="Registrar estorno" onClose={submitting ? () => {} : onClose}>
      <form className="form-stack refund-order-form" onSubmit={handleSubmit}>
        <div className="refund-order-summary">
          <span>{formatOrderDisplayNumber(order)} · {order.client}</span>
          <strong>{currency(amount)}</strong>
          <small>O valor integral pago será registrado como estorno e aparecerá como saída no Financeiro.</small>
        </div>

        <div className="form-field">
          <span>Forma de estorno</span>
          <SystemSelect
            value={refundMethod}
            options={PAYMENT_OPTIONS}
            onChange={setRefundMethod}
            placeholder="Selecione a forma do estorno"
            label="Forma de estorno"
            disabled={submitting}
          />
        </div>

        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>Voltar</Button>
          <Button type="submit" disabled={submitting || !refundMethod}>{submitting ? 'Registrando…' : 'Confirmar estorno'}</Button>
        </div>
      </form>
    </Modal>
  )
}

export default RegisterRefundDialog
