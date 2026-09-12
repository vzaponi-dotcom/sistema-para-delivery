import Button from './Button'
import { formatOrderDate } from '../utils/orderWorkflow.js'
import { formatOrderDisplayNumber } from '../../shared/orderDisplayNumber.js'

const timingText = (entry) => {
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
  canReceivePayments = true,
  canManagePaymentPromises = true,
  onRegisterPayment,
  onEditPaymentPromise,
  onViewOrder,
}) {
  if (!entry) return <div className="receivable-detail-empty">Selecione um recebimento para ver os detalhes.</div>

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
            {canReceivePayments && <Button type="button" onClick={() => { if (canReceivePayments) onRegisterPayment?.(order.id) }} disabled={disabled || !onRegisterPayment}>
              Registrar recebimento
            </Button>}
            {canManagePaymentPromises && <Button type="button" variant="secondary" onClick={() => { if (canManagePaymentPromises) onEditPaymentPromise?.(order) }} disabled={disabled || !onEditPaymentPromise}>
              {promise ? 'Alterar data prometida' : 'Definir data prometida'}
            </Button>}
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
