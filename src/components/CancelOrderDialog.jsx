import { useEffect, useState } from 'react'
import Button from './Button'
import Modal from './Modal'
import SystemSelect from './SystemSelect'
import { formatOrderDisplayNumber } from '../../shared/orderDisplayNumber.js'

const REASON_OPTIONS = [
  { value: 'client_changed_mind', label: 'Cliente desistiu' },
  { value: 'duplicate_order', label: 'Pedido duplicado' },
  { value: 'product_unavailable', label: 'Produto indisponível' },
  { value: 'entry_error', label: 'Erro no lançamento' },
  { value: 'other', label: 'Outro' },
]
const PAYMENT_OPTIONS = ['Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Transferência', 'Outro'].map((value) => ({ value, label: value }))

function CancelOrderDialog({ open, order, onClose, onConfirm, submitting = false, canRefundPayments = true }) {
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [refundNow, setRefundNow] = useState(false)
  const [refundMethod, setRefundMethod] = useState('Pix')
  const [error, setError] = useState('')
  const [reviewPayload, setReviewPayload] = useState(null)

  useEffect(() => {
    if (!open || !order) return
    setReason(''); setNote(''); setRefundNow(false); setRefundMethod(order.paymentMethod || 'Pix'); setError(''); setReviewPayload(null)
  }, [open, order])

  if (!open || !order) return null
  const isPaid = order.paymentStatus === 'Pago'
  const reasonLabel = REASON_OPTIONS.find((option) => option.value === reviewPayload?.reason)?.label

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!reason) return setError('Selecione um motivo para cancelar o pedido.')
    if (reason === 'other' && !note.trim()) return setError('Descreva o motivo do cancelamento.')
    if (isPaid && canRefundPayments && refundNow && !refundMethod) return setError('Selecione a forma usada no estorno.')
    setError('')
    setReviewPayload({ reason, note: reason === 'other' ? note.trim() : '', refundNow: isPaid && canRefundPayments ? refundNow : false, refundMethod: isPaid && canRefundPayments && refundNow ? refundMethod : '' })
  }

  const handleFinalConfirm = async () => {
    if (!reviewPayload || (reviewPayload.refundNow && !canRefundPayments)) return false
    await onConfirm?.(reviewPayload)
  }

  if (reviewPayload) {
    return (
      <Modal title="Revisar cancelamento" onClose={submitting ? () => {} : () => setReviewPayload(null)}>
        <div className="form-stack cancel-order-form">
          <div className="cancel-order-warning"><strong>{formatOrderDisplayNumber(order)} · {order.client}</strong><span>Esta ação cancela o pedido e o mantém somente no histórico.</span></div>
          <div className="payment-summary-card">
            <span>Motivo: {reasonLabel}{reviewPayload.note ? ` · ${reviewPayload.note}` : ''}</span>
            {isPaid && <span>{reviewPayload.refundNow ? `Estorno já realizado via ${reviewPayload.refundMethod}` : 'Estorno ficará pendente no Financeiro'}</span>}
          </div>
          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={() => setReviewPayload(null)} disabled={submitting}>Voltar e revisar</Button>
            <Button type="button" variant="danger" onClick={handleFinalConfirm} disabled={submitting}>{submitting ? 'Cancelando…' : 'Confirmar cancelamento definitivamente'}</Button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Cancelar pedido" onClose={submitting ? () => {} : onClose}>
      <form className="form-stack cancel-order-form" onSubmit={handleSubmit}>
          <div className="cancel-order-warning"><strong>{formatOrderDisplayNumber(order)} · {order.client}</strong><span>O pedido continuará no histórico e deixará de participar das vendas e da operação.</span></div>
        <div className="form-field"><span>Motivo do cancelamento</span><SystemSelect value={reason} options={REASON_OPTIONS} onChange={(value) => { setReason(value); setError('') }} placeholder="Selecione um motivo" label="Motivo do cancelamento" disabled={submitting} /></div>
        {reason === 'other' && <label className="form-field"><span>Descreva o motivo</span><textarea value={note} maxLength={240} onChange={(event) => { setNote(event.target.value); setError('') }} placeholder="Explique brevemente o motivo" disabled={submitting} /></label>}
        {isPaid && canRefundPayments && (
          <div className="cancel-refund-panel">
            <div><strong>Este pedido já foi pago.</strong><span>O valor já foi devolvido ao cliente?</span></div>
            <div className="cancel-refund-choice" role="group" aria-label="Situação do estorno">
              <button type="button" className={!refundNow ? 'button button-secondary active' : 'button button-secondary'} aria-pressed={!refundNow} onClick={() => { setRefundNow(false); setError('') }} disabled={submitting}>Ainda não</button>
              <button type="button" className={refundNow ? 'button button-secondary active' : 'button button-secondary'} aria-pressed={refundNow} onClick={() => { setRefundNow(true); setError('') }} disabled={submitting}>Sim</button>
            </div>
            {refundNow && <div className="form-field"><span>Forma do estorno</span><SystemSelect value={refundMethod} options={PAYMENT_OPTIONS} onChange={(value) => { setRefundMethod(value); setError('') }} label="Forma do estorno" disabled={submitting} /></div>}
            {!refundNow && <small>O cancelamento ficará com estorno pendente para ser registrado no Financeiro depois.</small>}
          </div>
        )}
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="form-actions"><Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>Voltar</Button><Button type="submit" disabled={submitting}>Revisar cancelamento</Button></div>
      </form>
    </Modal>
  )
}

export default CancelOrderDialog
