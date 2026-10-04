import { getOrderRefundState } from '../../domain/orderLifecycle.js'
import '../payment.css'

export default function OrderPaymentStatus({ order }) {
  const refund = getOrderRefundState(order)
  if (refund === 'pending') return <span className="payment-badge payment-pending">Estorno pendente</span>
  if (refund === 'refunded') return <span className="payment-badge payment-neutral">Estornado</span>
  const paid = order?.paymentStatus === 'Pago'
  return <span className={`payment-badge ${paid ? 'payment-paid' : order?.status === 'Cancelado' ? 'payment-neutral' : 'payment-pending'}`}>{paid ? 'Pago' : order?.status === 'Cancelado' ? 'Não recebido' : 'Pendente'}</span>
}
