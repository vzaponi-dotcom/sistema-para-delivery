import './payment.css'
function PaymentBadge({ order }) {
  const paid = order?.paymentStatus === 'Pago'
  const label = paid ? `Pago · ${order.paymentMethod || 'Não informado'}` : 'Pagamento pendente'

  return (
    <span className={paid ? 'payment-badge payment-paid' : 'payment-badge payment-pending'}>
      {label}
    </span>
  )
}

export default PaymentBadge
