import { useEffect, useState } from 'react'
import Button from './Button'
import Modal from './Modal'
import SystemSelect from './SystemSelect'
import { formatOrderDisplayNumber } from '../../shared/orderDisplayNumber.js'
import {
  PAYMENT_METHOD_OPTIONS,
  paymentOptionsWithSelection,
  paymentSelectionNeedsReview,
} from '../utils/paymentMethodOptions.js'

const currency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))

function RegisterRefundDialog({ open, order, onClose, onConfirm, submitting = false, paymentOptions = PAYMENT_METHOD_OPTIONS }) {
  const [refundMethod, setRefundMethod] = useState('')

  useEffect(() => {
    if (!open || !order) return
    setRefundMethod(order?.paymentMethod || '')
  }, [open, order])

  if (!open || !order) return null
  const originalMethodInactive = paymentSelectionNeedsReview(paymentOptions, refundMethod)
  const preservingOriginalMethod = refundMethod === (order.paymentMethod || '')
  const visibleOptions = paymentOptionsWithSelection(paymentOptions, refundMethod)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!refundMethod || originalMethodInactive || submitting) return
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
            options={visibleOptions}
            onChange={setRefundMethod}
            placeholder="Selecione a forma do estorno"
            label="Forma de estorno"
            disabled={submitting}
          />
          {originalMethodInactive && <small className="form-error" role="alert">{preservingOriginalMethod
            ? 'O método original está inativo hoje e foi preservado como referência. Escolha uma forma ativa para registrar o estorno.'
            : 'A forma escolhida ficou inativa. Escolha outra forma ativa para registrar o estorno.'}</small>}
        </div>

        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>Voltar</Button>
          <Button type="submit" disabled={submitting || !refundMethod || originalMethodInactive}>{submitting ? 'Registrando…' : 'Confirmar estorno'}</Button>
        </div>
      </form>
    </Modal>
  )
}

export default RegisterRefundDialog
