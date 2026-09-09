import Button from './Button'
import { getOrderItemDisplayName, getOrderItems } from '../utils/orderCart.js'
import { formatOrderDate } from '../utils/orderWorkflow.js'
import { formatOrderDisplayNumber } from '../../shared/orderDisplayNumber.js'

const timingText = (entry) => {
  if (entry.kind === 'table_tab') {
    if (entry.timing?.status === 'overdue') return `Em atraso há ${entry.timing.daysOverdue} dia(s)`
    if (entry.timing?.status === 'today') return 'Pagamento esperado hoje'
    if (entry.timing?.status === 'upcoming') return `Previsto para ${formatOrderDate(entry.expectedDate)}`
    return 'Pendente'
  }

  if (entry.order?.paymentStatus === 'Pago') return 'Quitado'
  if (entry.timing?.status === 'overdue') return `Em atraso há ${entry.timing.daysOverdue} dia(s)`
  if (entry.timing?.status === 'today') return entry.order?.promisedPaymentDate ? 'Prometido para hoje' : 'Pagamento esperado hoje'
  if (entry.timing?.status === 'upcoming') return `${entry.order?.promisedPaymentDate ? 'Prometido' : 'Previsto'} para ${formatOrderDate(entry.expectedDate)}`
  return 'Pendente'
}

function ReceivableDetail({
  entry,
  currency,
  disabled = false,
  onRegisterPayment,
  onRegisterTableTabPayment,
  onEditPaymentPromise,
  onViewOrder,
}) {
  if (!entry) return <div className="receivable-detail-empty">Selecione um recebimento para ver os detalhes.</div>

  if (entry.kind === 'table_tab') {
    return (
      <div className="receivable-detail">
        <div className="receivable-detail-heading receivable-table-tab-heading">
          <div>
            <span>Comanda</span>
            <strong>{entry.label}</strong>
          </div>
          <div className="receivable-table-tab-total">
            <span>Total da comanda</span>
            <strong>{currency(entry.total)}</strong>
          </div>
        </div>
        <div className="receivable-detail-status">
          <span>Prazo</span>
          <strong>{timingText(entry)}</strong>
        </div>
        <div className="receivable-detail-meta">
          <div><span>Pedidos pendentes</span><strong>{entry.orders.length}</strong></div>
          <div><span>Data de referência</span><strong>{formatOrderDate(entry.expectedDate)}</strong></div>
        </div>
        <div className="receivable-table-tab-orders">
          {entry.orders.map((order) => (
            <section className="receivable-table-tab-order" key={order.id}>
              <div className="receivable-table-tab-order-heading">
                <div><span>Pedido</span><strong>{formatOrderDisplayNumber(order)}</strong></div>
                <div className="receivable-table-tab-order-subtotal"><span>Subtotal</span><strong>{currency(order.total ?? order.subtotal ?? 0)}</strong></div>
              </div>
              <div className="receivable-table-tab-items">
                {getOrderItems(order).map((item) => (
                  <div className="receivable-table-tab-item" key={item.id || item.lineId || `${item.productId}-${item.name}-${item.note}`}>
                    <span className="receivable-table-tab-item-quantity">{item.quantity}x</span>
                    <div className="receivable-table-tab-item-content">
                      <strong>{getOrderItemDisplayName(item)}</strong>
                      {item.note && <span>↳ {item.note}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
        <p className="receivable-detail-note">A comanda é recebida de forma integral. A data prometida não é editada por aqui nesta versão.</p>
        <div className="receivable-table-tab-payment-footer">
          <span>Confira os pedidos antes de receber a comanda.</span>
          <div className="receivable-detail-actions">
            <Button type="button" onClick={() => onRegisterTableTabPayment?.(entry)} disabled={disabled || !onRegisterTableTabPayment}>
              Registrar pagamento da comanda
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const order = entry.order
  const paid = order?.paymentStatus === 'Pago'
  const promise = order?.promisedPaymentDate || null

  return (
    <div className="receivable-detail">
      <div className="receivable-detail-heading">
        <div>
          <span>{paid ? 'Recebimento quitado' : 'Recebimento pendente'}</span>
          <strong>{order?.client || 'Pedido sem identificação'}</strong>
        </div>
        <strong className="receivable-detail-total">{currency(order?.total || entry.total || 0)}</strong>
      </div>

      <div className={`receivable-detail-status receivable-detail-status-${entry.timing?.status || (paid ? 'paid' : 'pending')}`}>
        <span>Situação</span>
        <strong>{timingText(entry)}</strong>
      </div>

      <div className="receivable-detail-meta">
        <div><span>Pedido</span><strong>{formatOrderDisplayNumber(order)}</strong></div>
        <div><span>Data do pedido</span><strong>{formatOrderDate(order?.orderDate)}</strong></div>
        <div><span>Data prometida</span><strong>{promise ? formatOrderDate(promise) : 'Não definida'}</strong></div>
        {paid && <div><span>Forma de pagamento</span><strong>{order?.paymentMethod || 'Não informada'}</strong></div>}
      </div>

      <div className="receivable-detail-actions">
        {!paid && (
          <>
            <Button type="button" onClick={() => onRegisterPayment?.(order.id)} disabled={disabled || !onRegisterPayment}>
              Registrar recebimento
            </Button>
            <Button type="button" variant="secondary" onClick={() => onEditPaymentPromise?.(order)} disabled={disabled || !onEditPaymentPromise}>
              {promise ? 'Alterar data prometida' : 'Definir data prometida'}
            </Button>
          </>
        )}
        <Button type="button" variant="secondary" onClick={() => onViewOrder?.(order)} disabled={!onViewOrder}>
          Ver pedido
        </Button>
      </div>
    </div>
  )
}

export default ReceivableDetail
