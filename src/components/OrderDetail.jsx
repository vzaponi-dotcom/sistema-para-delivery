import Modal from './Modal'
import PaymentBadge from './PaymentBadge'
import StatusBadge from './StatusBadge'
import { getOrderItems } from '../utils/orderCart.js'
import { formatOrderDate, formatOrderTime } from '../utils/orderWorkflow.js'

const adjustmentLabel = (adjustment, currency) => {
  if (!adjustment || adjustment.type === 'none') return ''
  const prefix = adjustment.type === 'discount' ? 'Desconto' : 'Acréscimo'
  const value = adjustment.mode === 'percentage'
    ? `${Number(adjustment.value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
    : currency(adjustment.amount || adjustment.value || 0)
  return `${prefix} ${value}`
}

function OrderDetail({ order, currency, onClose }) {
  if (!order) return null
  const items = getOrderItems(order)
  const adjustment = order.adjustment || { type: 'none' }

  return (
    <Modal title={`Pedido #${String(order.id).slice(-4)}`} onClose={onClose}>
      <div className="order-detail">
        <div className="order-detail-heading">
          <div>
            <span>Cliente</span>
            <strong>{order.client}</strong>
          </div>
          <div className="order-detail-badges">
            <StatusBadge status={order.status} />
            <PaymentBadge order={order} />
          </div>
        </div>

        <div className="order-detail-meta">
          <div><span>Tipo</span><strong>{order.type}</strong></div>
          <div><span>Data</span><strong>{formatOrderDate(order.orderDate)}</strong></div>
          <div><span>Horário</span><strong>{formatOrderTime(order.createdAt) || '—'}</strong></div>
          <div><span>Forma de pagamento</span><strong>{order.paymentStatus === 'Pago' ? (order.paymentMethod || 'Não informada') : 'Pendente'}</strong></div>
        </div>

        <section className="order-detail-section">
          <div className="section-heading compact-section-heading">
            <div>
              <span className="section-kicker">Itens</span>
              <h3>Conteúdo do pedido</h3>
            </div>
          </div>
          <div className="order-detail-items">
            {items.map((item) => (
              <div className="order-detail-item" key={item.id || item.lineId || `${item.productId}-${item.name}-${item.note}`}>
                <div>
                  <strong>{item.quantity}x {item.name}</strong>
                  {item.note && <span>↳ {item.note}</span>}
                </div>
                <strong>{currency(Number(item.unitPrice ?? item.catalogPrice ?? 0) * Number(item.quantity || 1))}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="order-detail-totals">
          <div><span>Subtotal</span><strong>{currency(order.subtotal ?? order.total ?? 0)}</strong></div>
          {Number(order.deliveryFee || 0) > 0 && <div><span>Taxa de entrega</span><strong>{currency(order.deliveryFee)}</strong></div>}
          {adjustment.type !== 'none' && (
            <>
              <div>
                <span>{adjustmentLabel(adjustment, currency)}</span>
                <strong>{adjustment.type === 'discount' ? '− ' : '+ '}{currency(adjustment.amount || 0)}</strong>
              </div>
              {adjustment.reason && <div className="order-detail-reason"><span>Motivo</span><strong>{adjustment.reason}</strong></div>}
            </>
          )}
          <div className="order-detail-total-final"><span>Total</span><strong>{currency(order.total)}</strong></div>
        </section>
      </div>
    </Modal>
  )
}

export default OrderDetail
