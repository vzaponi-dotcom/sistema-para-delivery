import { useEffect, useRef, useState } from 'react'
import Button from './Button'
import Modal from './Modal'
import SystemSelect from './SystemSelect'
import { PAYMENT_METHOD_OPTIONS } from '../utils/paymentMethodOptions.js'

function PaymentForm({ detail, currency, disabled, onClose, onConfirm }) {
  const [method, setMethod] = useState('Pix')
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const close = () => { if (!inFlight.current) onClose() }
  const submit = async (event) => {
    event.preventDefault()
    if (disabled || inFlight.current || detail.status !== 'open' || detail.orderCount < 1 || detail.totalCents <= 0) return
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
        <div className="form-field"><span>Forma de pagamento</span><SystemSelect value={method} options={PAYMENT_METHOD_OPTIONS} onChange={setMethod} disabled={disabled || busy} label="Forma de pagamento" /></div>
        <div className="form-actions"><Button type="button" variant="secondary" disabled={busy} onClick={close}>Cancelar</Button><Button type="submit" disabled={disabled || busy}>Confirmar pagamento</Button></div>
      </form>
    </Modal>
  )
}

export default function TableTabPaymentDialog({ open, detail, ...props }) {
  return open && detail ? <PaymentForm key={detail.id} detail={detail} {...props} /> : null
}
