import { useEffect, useRef, useState } from 'react'
import Button from '../../../../shared/ui/Button'
import Modal from '../../../../shared/ui/Modal'
import { PAYMENT_METHOD_OPTIONS } from '../../../../domains/finance/index.js'
import PaymentCompositionEditor from '../PaymentCompositionEditor.jsx'
import {
  createInitialPaymentComposition,
  summarizePaymentComposition,
  toPaymentAllocations,
} from '../paymentComposition.js'

function PaymentForm({ detail, currency, disabled, onClose, onConfirm, paymentOptions, defaultPaymentMethod }) {
  const [allocations, setAllocations] = useState(() => createInitialPaymentComposition({
    totalCents: detail.totalCents,
    defaultPaymentMethod,
    paymentOptions,
  }))
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const mounted = useRef(true)
  const composition = summarizePaymentComposition(allocations, detail.totalCents, paymentOptions)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const close = () => {
    if (!inFlight.current) onClose()
  }

  const submit = async (event) => {
    event.preventDefault()
    const submittedAllocations = toPaymentAllocations(allocations, detail.totalCents, paymentOptions)
    if (
      disabled
      || inFlight.current
      || !submittedAllocations
      || detail.status !== 'open'
      || detail.orderCount < 1
      || detail.totalCents <= 0
    ) return false

    inFlight.current = true
    setBusy(true)
    try {
      const success = await onConfirm(detail.id, submittedAllocations)
      if (mounted.current && success) onClose()
      return Boolean(success)
    } finally {
      if (mounted.current) {
        inFlight.current = false
        setBusy(false)
      }
    }
  }

  return (
    <Modal title="Registrar pagamento" onClose={close}>
      <form className="form-stack" onSubmit={submit}>
        <div className="payment-summary-card">
          <span>Comanda {detail.number} · {detail.table.name}</span>
          <strong>{currency(detail.totalCents / 100)}</strong>
          <small>Pagamento integral. O pagamento será lançado automaticamente como entrada no Financeiro.</small>
        </div>

        <PaymentCompositionEditor
          totalCents={detail.totalCents}
          allocations={allocations}
          onChange={setAllocations}
          paymentOptions={paymentOptions}
          disabled={disabled || busy}
        />

        <div className="form-actions">
          <Button type="button" variant="secondary" disabled={busy} onClick={close}>Cancelar</Button>
          <Button
            type="submit"
            disabled={disabled || busy || !composition.valid}
          >
            Confirmar pagamento
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default function TableTabPaymentDialog({
  open,
  detail,
  paymentOptions = PAYMENT_METHOD_OPTIONS,
  defaultPaymentMethod = paymentOptions[0]?.value || '',
  ...props
}) {
  return open && detail
    ? (
      <PaymentForm
        key={detail.id}
        detail={detail}
        paymentOptions={paymentOptions}
        defaultPaymentMethod={defaultPaymentMethod}
        {...props}
      />
    )
    : null
}
