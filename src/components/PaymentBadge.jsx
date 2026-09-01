import './payment.css'
import { isOrderPaid } from '../utils/paymentWorkflow'

function PaymentBadge({ order }) {
  const paid = isOrderPaid(order)
  const label = paid ? `Pago · ${order.paymentMethod || 'Não informado'}` : 'Pagamento pendente'

  return (
    <span className={paid ? 'payment-badge payment-paid' : 'payment-badge payment-pending'}>
      {label}
    </span>
  )
}

export default PaymentBadge
