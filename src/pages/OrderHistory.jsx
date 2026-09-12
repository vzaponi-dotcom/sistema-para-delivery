import { useEffect, useMemo, useState } from 'react'
import '../order-operations.css'
import '../order-operations-compact.css'
import Button from '../components/Button'
import CancelOrderDialog from '../components/CancelOrderDialog'
import Icon from '../components/Icon'
import OrderDetail from '../components/OrderDetail'
import OperationalHistoryAnalysis from '../components/OperationalHistoryAnalysis'
import AreaNavigation from '../components/AreaNavigation'
import PageHeader from '../components/PageHeader'
import PaymentBadge from '../components/PaymentBadge'
import StatusBadge from '../components/StatusBadge'
import { getOrderItemsSummary } from '../utils/orderCart.js'
import { getOrderRefundState, isOrderFinished } from '../utils/orderLifecycle.js'
import { canReceiveStandaloneOrder } from '../utils/orderPaymentEligibility.js'
import { formatCancellationDate, formatOrderDate } from '../utils/orderWorkflow.js'
import { formatOrderDisplayNumber } from '../../shared/orderDisplayNumber.js'

const reasonLabels = { client_changed_mind: 'Cliente desistiu', duplicate_order: 'Pedido duplicado', product_unavailable: 'Produto indisponível', entry_error: 'Erro no lançamento', other: 'Outro' }
const timestamp = (order) => order.cancelledAt || order.finishedAt || order.createdAt
const defaultCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))

function OrderHistory({ orders = [], currency = defaultCurrency, onCancelOrder, onRegisterPayment, paymentDisabled = false, actionKey = null, printing, onToast, queryState, onQueryChange, granted, implemented, onNavigate, activeTab, canViewAnalysis = false, canCancelOrders = true, canRefundPayments = true, canExecutePrinting = true, now = new Date() }) {
  const filter = queryState.filter
  const [detailOrderId, setDetailOrderId] = useState(null)
  const [cancelOrder, setCancelOrder] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const terminalOrders = useMemo(() => orders.filter(isOrderFinished).filter((order) => filter === 'all' || (filter === 'finalized' ? order.status === 'Finalizado' : order.status === 'Cancelado')).sort((a, b) => new Date(timestamp(b)).getTime() - new Date(timestamp(a)).getTime()), [filter, orders])
  const detailOrder = detailOrderId ? orders.find((order) => order.id === detailOrderId) ?? null : null

  useEffect(() => {
    if (detailOrderId && !detailOrder) setDetailOrderId(null)
  }, [detailOrder, detailOrderId])

  const confirmCancellation = async (payload) => {
    if (!canCancelOrders || (payload?.refundNow && !canRefundPayments) || !cancelOrder || submitting || !onCancelOrder) return false
    setSubmitting(true)
    try { const saved = await onCancelOrder(cancelOrder.id, payload); if (saved !== false) setCancelOrder(null) } finally { setSubmitting(false) }
  }

  const registerPaymentFromDetail = () => {
    if (!canReceiveStandaloneOrder(detailOrder, granted, 'history')) return
    if (onRegisterPayment?.(detailOrder.id, 'history')) setDetailOrderId(null)
  }

  return (
    <>
      <PageHeader eyebrow="Pedidos" title="Histórico" description="Consulte pedidos finalizados e cancelados sem apagar o registro original da operação." />
      <AreaNavigation area="orders" activeTab={activeTab} granted={granted} implemented={implemented} onNavigate={onNavigate} />
      {canViewAnalysis && (
        <OperationalHistoryAnalysis
          orders={orders}
          period={queryState.analysisPeriod}
          onPeriodChange={(analysisPeriod) => onQueryChange({ analysisPeriod })}
          now={now}
        />
      )}
      <section className="surface-card order-history-surface">
        <div className="history-toolbar">
          <div className="history-filter" role="group" aria-label="Filtrar histórico">
            <button type="button" className={filter === 'all' ? 'button button-secondary active' : 'button button-secondary'} aria-pressed={filter === 'all'} onClick={() => onQueryChange({ filter: 'all' })}>Todos</button>
            <button type="button" className={filter === 'finalized' ? 'button button-secondary active' : 'button button-secondary'} aria-pressed={filter === 'finalized'} onClick={() => onQueryChange({ filter: 'finalized' })}>Finalizados</button>
            <button type="button" className={filter === 'cancelled' ? 'button button-secondary active' : 'button button-secondary'} aria-pressed={filter === 'cancelled'} onClick={() => onQueryChange({ filter: 'cancelled' })}>Cancelados</button>
          </div>
          <span className="toolbar-count">{terminalOrders.length} registro(s)</span>
        </div>
        <div className="order-history-list">
          {terminalOrders.map((order) => {
            const refundState = getOrderRefundState(order)
            const cancelReason = reasonLabels[order.cancelReason] || order.cancelReason || ''
            return (
              <article className="order-history-row" key={order.id}>
                <div className="order-history-number">{formatOrderDisplayNumber(order)}</div>
                <div className="order-history-main">
                  <strong>{order.client}</strong>
                  <span>{getOrderItemsSummary(order)} · {order.type} · {formatOrderDate(order.orderDate)}</span>
                  {order.status === 'Cancelado' && <small className="order-cancel-meta">Cancelado em {formatCancellationDate(order.cancelledAt)} · Motivo: {cancelReason}{order.cancelReasonNote ? ` · ${order.cancelReasonNote}` : ''}</small>}
                </div>
                <div className="order-history-badges"><StatusBadge status={order.status} /><PaymentBadge order={order} />{refundState === 'pending' && <span className="status-badge status-warning">Estorno pendente</span>}{refundState === 'refunded' && <span className="status-badge status-success">Estornado</span>}</div>
                <div className="order-history-value"><strong>{currency(order.total)}</strong></div>
                <div className="order-history-actions"><Button type="button" variant="secondary" onClick={() => setDetailOrderId(order.id)}>Ver detalhes</Button>{canCancelOrders && order.status === 'Finalizado' && <Button type="button" variant="secondary" className="button-danger-outline" disabled={Boolean(actionKey) || submitting} onClick={() => { if (canCancelOrders) setCancelOrder(order) }}>Cancelar pedido</Button>}</div>
              </article>
            )
          })}
          {!terminalOrders.length && <div className="empty-state compact-empty-state"><Icon name="orders" size={28} /><strong>Nenhum pedido neste filtro</strong><span>Os pedidos finalizados e cancelados aparecerão aqui.</span></div>}
        </div>
      </section>
      {detailOrder && <OrderDetail order={detailOrder} currency={currency} printing={printing} printJob={printing?.latestJobByOrderId?.get(detailOrder.id)} onClose={() => setDetailOrderId(null)} onRequestCancel={canCancelOrders ? () => { if (!canCancelOrders) return; setDetailOrderId(null); setCancelOrder(detailOrder) } : undefined} canCancelOrders={canCancelOrders} canExecutePrinting={canExecutePrinting} canRegisterPayment={canReceiveStandaloneOrder(detailOrder, granted, 'history')} registerPaymentDisabled={paymentDisabled || Boolean(actionKey) || submitting} onRegisterPayment={registerPaymentFromDetail} onToast={onToast} />}
      <CancelOrderDialog open={canCancelOrders && Boolean(cancelOrder)} order={cancelOrder} onClose={() => setCancelOrder(null)} onConfirm={confirmCancellation} submitting={submitting} canRefundPayments={canRefundPayments} />
    </>
  )
}

export default OrderHistory
