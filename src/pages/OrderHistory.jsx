import { useEffect, useMemo, useState } from 'react'
import '../order-operations.css'
import '../order-operations-compact.css'
import { cancelOrder as cancelOrderApi, getOrders as getOrdersApi } from '../api/client.js'
import Button from '../components/Button'
import CancelOrderDialog from '../components/CancelOrderDialog'
import Icon from '../components/Icon'
import OrderDetail from '../components/OrderDetail'
import PageHeader from '../components/PageHeader'
import PaymentBadge from '../components/PaymentBadge'
import StatusBadge from '../components/StatusBadge'
import { getOrderItemsSummary } from '../utils/orderCart.js'
import { getOrderRefundState, isOrderFinished } from '../utils/orderLifecycle.js'
import { formatOrderDate } from '../utils/orderWorkflow.js'

const reasonLabels = {
  client_changed_mind: 'Cliente desistiu',
  duplicate_order: 'Pedido duplicado',
  product_unavailable: 'Produto indisponível',
  entry_error: 'Erro no lançamento',
  other: 'Outro',
}

const orderNumber = (id) => String(id).slice(-4)
const timestamp = (order) => order.cancelledAt || order.finishedAt || order.createdAt
const defaultCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))

function OrderHistory({ orders: suppliedOrders, currency = defaultCurrency, onCancelOrder, actionKey = null }) {
  const [loadedOrders, setLoadedOrders] = useState([])
  const [filter, setFilter] = useState('all')
  const [detailOrder, setDetailOrder] = useState(null)
  const [cancelOrder, setCancelOrder] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')
  const orders = suppliedOrders ?? loadedOrders

  useEffect(() => {
    if (suppliedOrders) return undefined
    let cancelled = false
    const load = async () => {
      try {
        const data = await getOrdersApi()
        if (!cancelled && Array.isArray(data?.orders)) setLoadedOrders(data.orders)
      } catch (error) {
        if (!cancelled) setFeedback(error?.message || 'Não foi possível carregar o histórico.')
      }
    }
    void load()
    return () => { cancelled = true }
  }, [suppliedOrders])

  const terminalOrders = useMemo(() => orders
    .filter(isOrderFinished)
    .filter((order) => filter === 'all' || (filter === 'finalized' ? order.status === 'Finalizado' : order.status === 'Cancelado'))
    .sort((a, b) => new Date(timestamp(b)).getTime() - new Date(timestamp(a)).getTime()), [filter, orders])

  const startCancellation = (order) => {
    if (onCancelOrder) onCancelOrder(order)
    else setCancelOrder(order)
  }

  const confirmCancellation = async (payload) => {
    if (!cancelOrder || submitting) return
    setSubmitting(true)
    try {
      const { order } = await cancelOrderApi(cancelOrder.id, payload)
      setLoadedOrders((current) => current.map((item) => item.id === order.id ? { ...item, ...order } : item))
      setCancelOrder(null)
      setFeedback(payload.refundNow ? 'Pedido cancelado e estorno registrado.' : 'Pedido cancelado com sucesso.')
    } catch (error) {
      setFeedback(error?.message || 'Não foi possível cancelar o pedido.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader eyebrow="Pedidos" title="Histórico" description="Consulte pedidos finalizados e cancelados sem apagar o registro original da operação." />
      {feedback && <div className="order-action-feedback" role="status">{feedback}</div>}

      <section className="surface-card order-history-surface">
        <div className="history-toolbar">
          <div className="history-filter" role="group" aria-label="Filtrar histórico">
            <button type="button" className={filter === 'all' ? 'button button-secondary active' : 'button button-secondary'} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Todos</button>
            <button type="button" className={filter === 'finalized' ? 'button button-secondary active' : 'button button-secondary'} aria-pressed={filter === 'finalized'} onClick={() => setFilter('finalized')}>Finalizados</button>
            <button type="button" className={filter === 'cancelled' ? 'button button-secondary active' : 'button button-secondary'} aria-pressed={filter === 'cancelled'} onClick={() => setFilter('cancelled')}>Cancelados</button>
          </div>
          <span className="toolbar-count">{terminalOrders.length} registro(s)</span>
        </div>

        <div className="order-history-list">
          {terminalOrders.map((order) => {
            const refundState = getOrderRefundState(order)
            const cancelReason = reasonLabels[order.cancelReason] || order.cancelReason || ''
            return (
              <article className="order-history-row" key={order.id}>
                <div className="order-history-number">#{orderNumber(order.id)}</div>
                <div className="order-history-main">
                  <strong>{order.client}</strong>
                  <span>{getOrderItemsSummary(order)} · {order.type} · {formatOrderDate(order.orderDate)}</span>
                  {order.status === 'Cancelado' && <small className="order-cancel-meta">Motivo: {cancelReason}{order.cancelReasonNote ? ` · ${order.cancelReasonNote}` : ''}</small>}
                </div>
                <div className="order-history-badges">
                  <StatusBadge status={order.status} />
                  <PaymentBadge order={order} />
                  {refundState === 'pending' && <span className="status-badge status-warning">Estorno pendente</span>}
                  {refundState === 'refunded' && <span className="status-badge status-success">Estornado</span>}
                </div>
                <div className="order-history-value"><strong>{currency(order.total)}</strong></div>
                <div className="order-history-actions">
                  <Button type="button" variant="secondary" onClick={() => setDetailOrder(order)}>Ver detalhes</Button>
                  {order.status === 'Finalizado' && <Button type="button" variant="secondary" className="button-danger-outline" disabled={Boolean(actionKey) || submitting} onClick={() => startCancellation(order)}>Cancelar pedido</Button>}
                </div>
              </article>
            )
          })}
          {!terminalOrders.length && <div className="empty-state compact-empty-state"><Icon name="orders" size={28} /><strong>Nenhum pedido neste filtro</strong><span>Os pedidos finalizados e cancelados aparecerão aqui.</span></div>}
        </div>
      </section>

      {detailOrder && <OrderDetail order={detailOrder} currency={currency} onClose={() => setDetailOrder(null)} />}
      <CancelOrderDialog open={Boolean(cancelOrder)} order={cancelOrder} onClose={() => setCancelOrder(null)} onConfirm={confirmCancellation} submitting={submitting} />
    </>
  )
}

export default OrderHistory
