import { useState } from 'react'
import Button from '../../../shared/ui/Button.jsx'
import PaymentCompositionEditor from './PaymentCompositionEditor.jsx'
import { createInitialPaymentComposition, toPaymentAllocations } from './paymentComposition.js'

export default function CheckoutPaymentComposition({
  totalCents,
  paymentOptions,
  defaultPaymentMethod,
  disabled = false,
  onCancel,
  onConfirm,
}) {
  const [allocations, setAllocations] = useState(() => createInitialPaymentComposition({
    totalCents,
    paymentOptions,
    defaultPaymentMethod,
  }))
  const payload = toPaymentAllocations(allocations, totalCents, paymentOptions)

  return (
    <div className="new-order-payment-choice">
      <PaymentCompositionEditor
        totalCents={totalCents}
        allocations={allocations}
        onChange={setAllocations}
        paymentOptions={paymentOptions}
        disabled={disabled}
      />
      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={disabled}>Voltar</Button>
        <Button type="button" onClick={() => payload && onConfirm?.(payload)} disabled={disabled || !payload}>Confirmar recebimento</Button>
      </div>
    </div>
  )
}
