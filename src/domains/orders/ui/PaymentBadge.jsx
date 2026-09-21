import './payment.css'
import { formatPaymentSummary } from '../../finance/index.js'
function PaymentBadge({ order }) {
  const paid = order?.paymentStatus === 'Pago'
  const label = paid ? `Pago · ${formatPaymentSummary(order.paymentAllocations, order.paymentMethod)}` : 'Pagamento pendente'

  return (
    <span className={paid ? 'payment-badge payment-paid' : 'payment-badge payment-pending'}>
      {label}
    </span>
  )
}

export default PaymentBadge
