import { useEffect, useRef, useState } from 'react'
import Button from '../../../../components/Button'
import Modal from '../../../../components/Modal'
import SystemSelect from '../../../../components/SystemSelect'
import {
  PAYMENT_METHOD_OPTIONS,
  paymentOptionsWithSelection,
  paymentSelectionNeedsReview,
} from '../../../../domains/finance/index.js'

function PaymentForm({ detail, currency, disabled, onClose, onConfirm, paymentOptions, defaultPaymentMethod }) {
  const [method, setMethod] = useState(defaultPaymentMethod || '')
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const mounted = useRef(true)
  const selectionNeedsReview = paymentSelectionNeedsReview(paymentOptions, method)
  const visibleOptions = paymentOptionsWithSelection(paymentOptions, method)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const close = () => { if (!inFlight.current) onClose() }
  const submit = async (event) => {
    event.preventDefault()
    if (disabled || inFlight.current || !method || selectionNeedsReview || detail.status !== 'open' || detail.orderCount < 1 || detail.totalCents <= 0) return
    inFlight.current = true
    setBusy(true)
    try {
      const success = await onConfirm(detail.id, method)
      if (mounted.current && success) onClose()
    } finally {
      if (mounted.current) { inFlight.current = false; setBusy(false) }
    }
  }
  return (
    <Modal title="Registrar pagamento" onClose={close}>
      <form className="form-stack" onSubmit={submit}>
        <div className="payment-summary-card"><span>Comanda {detail.number} · {detail.table.name}</span><strong>{currency(detail.totalCents / 100)}</strong><small>Pagamento integral. O pagamento será lançado automaticamente como entrada no Financeiro.</small></div>
        <div className="form-field"><span>Forma de pagamento</span><SystemSelect value={method} options={visibleOptions} onChange={setMethod} disabled={disabled || busy} label="Forma de pagamento" /></div>
        {selectionNeedsReview && <p className="form-error" role="alert">A forma escolhida não está mais ativa. Revise a seleção antes de confirmar.</p>}
        <div className="form-actions"><Button type="button" variant="secondary" disabled={busy} onClick={close}>Cancelar</Button><Button type="submit" disabled={disabled || busy || !method || selectionNeedsReview}>Confirmar pagamento</Button></div>
      </form>
    </Modal>
  )
}

export default function TableTabPaymentDialog({ open, detail, paymentOptions = PAYMENT_METHOD_OPTIONS, defaultPaymentMethod = paymentOptions[0]?.value || '', ...props }) {
  return open && detail ? <PaymentForm key={detail.id} detail={detail} paymentOptions={paymentOptions} defaultPaymentMethod={defaultPaymentMethod} {...props} /> : null
}
