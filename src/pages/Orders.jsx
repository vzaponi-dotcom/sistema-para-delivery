import { useEffect, useMemo, useState } from 'react'
import '../order-operations.css'
import Button from '../components/Button'
import Icon from '../components/Icon'
import OrderDetail from '../components/OrderDetail'
import PageHeader from '../components/PageHeader'
import PaymentBadge from '../components/PaymentBadge'
import StatCard from '../components/StatCard'
import StatusBadge from '../components/StatusBadge'
import { getOrderItemDisplayName, getOrderItems, getOrderItemsSearchText, getOrderItemsSummary } from '../utils/orderCart.js'
import {
  formatOrderDate,
  formatOrderTime,
  getElapsedMinutes,
  getFinalActionLabel,
  getOrderTimingState,
  getOrderUrgency,
  isFinishedToday,
  isOrderFinished,
} from '../utils/orderWorkflow'

const orderNumber = (id) => String(id).slice(-4)

const timingLabels = {
  'on-time': 'No prazo',
  late: 'Atrasado',
  'very-late': 'Muito atrasado',
}

const finishedTime = (order) => {
  if (!order.finishedAt) return formatOrderDate(order.orderDate)

  return new Date(order.finishedAt).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Orders({ orders, search, onSearchChange, currency, onNewOrder, onFinalizeOrder, onDeleteOrder }) {
  const [now, setNow] = useState(() => new Date())
  const [pendingAction, setPendingAction] = useState(null)
  const [detailOrder, setDetailOrder] = useState(null)
  const writeDisabled = typeof navigator !== 'undefined' && !navigator.onLine
  const actionsDisabled = writeDisabled || pendingAction !== null

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const runAction = async (key, action) => {
    if (actionsDisabled) return
    setPendingAction(key)
    try {
      await action()
    } finally {
      setPendingAction(null)
    }
  }

  const normalizedSearch = search.trim().toLowerCase()

  const visibleOrders = useMemo(() => {
    if (!normalizedSearch) return orders

    return orders.filter((order) =>
      [
        order.client,
        order.type,
        order.orderDate,
        getOrderItemsSearchText(order),
        order.status,
        order.paymentStatus,
        order.paymentMethod,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch),
    )
  }, [normalizedSearch, orders])

  const activeOrders = useMemo(
    () =>
      visibleOrders
        .filter((order) => !isOrderFinished(order))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [visibleOrders],
  )

  const finishedOrders = useMemo(
    () =>
      visibleOrders
        .filter(isOrderFinished)
        .sort((a, b) => new Date(b.finishedAt).getTime() - new Date(a.finishedAt).getTime()),
    [visibleOrders],
  )

  const activeCount = orders.filter((order) => !isOrderFinished(order)).length
  const delayedCount = orders.filter(
    (order) => !isOrderFinished(order) && getOrderTimingState(order, now) !== 'on-time',
  ).length
  const finishedTodayCount = orders.filter((order) => isFinishedToday(order, now)).length

  return (
    <>
      <PageHeader
        eyebrow="Operação"
        title="Pedidos em preparo"
        description="Acompanhe a fila pela hora real de entrada. Todos os itens e observações ficam visíveis para a cozinha."
        actions={<Button icon="plus" onClick={onNewOrder} disabled={actionsDisabled}>Novo pedido</Button>}
      />

      <section className="stats-grid stats-grid-three order-ops-stats" aria-label="Resumo dos pedidos">
        <StatCard label="Em preparo" value={activeCount} helper="Pedidos ativos agora" icon="receipt" />
        <StatCard label="Com atraso" value={delayedCount} helper="Mais de 30 min" icon="orders" tone={delayedCount ? 'danger' : 'neutral'} />
        <StatCard label="Finalizados hoje" value={finishedTodayCount} helper="Já saíram da operação" icon="dashboard" tone="success" />
      </section>

      <section className="surface-card order-ops-surface">
        <div className="toolbar">
          <label className="search-control">
            <Icon name="search" size={18} />
            <input
              type="search"
              placeholder="Buscar cliente, produto, pagamento ou tipo"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </label>
          <span className="toolbar-count">{activeOrders.length} na fila</span>
        </div>

        <div className="section-heading order-queue-heading">
          <div>
            <span className="section-kicker">Cozinha</span>
            <h2>Fila em preparo</h2>
          </div>
          <span className="order-queue-help">Mais antigos aparecem primeiro</span>
        </div>

        <div className="order-queue">
          {activeOrders.map((order) => {
            const elapsed = getElapsedMinutes(order, now)
            const urgency = getOrderUrgency(order, now)
            const timingState = getOrderTimingState(order, now)
            const timingLabel = timingLabels[timingState]
            const orderTime = formatOrderTime(order.createdAt)
            const elapsedLabel = elapsed < 1 ? 'agora' : `há ${elapsed} min`

            return (
              <article className={`order-queue-card urgency-${urgency}`} key={order.id}>
                <div
                  className={`order-timing-marker timing-${timingState}`}
                  title={`${timingLabel}. Pedido registrado às ${orderTime}.`}
                >
                  <span className="order-timing-dot" aria-hidden="true" />
                  <strong>{timingLabel}</strong>
                </div>

                <div className="order-queue-body">
                  <div className="order-queue-number">#{orderNumber(order.id)}</div>

                  <div className="order-queue-main">
                    <div className="order-queue-title">
                      <div>
                        <strong>{order.client}</strong>
                        <span>{order.type} · {currency(order.total)}</span>
                      </div>
                      <div className="order-queue-badges">
                        <StatusBadge status="Em preparo" />
                        <PaymentBadge order={order} />
                      </div>
                    </div>

                    <div className="order-items-list">
                      {getOrderItems(order).map((item) => (
                        <div className="order-item-line" key={item.id || item.lineId || `${item.productId}-${item.name}-${item.note}`}>
                          <strong>{item.quantity}x {getOrderItemDisplayName(item)}</strong>
                          {item.note && <span>↳ {item.note}</span>}
                        </div>
                      ))}
                    </div>

                    <div className="order-queue-meta">
                      <span>{formatOrderDate(order.orderDate)}</span>
                      {Number(order.deliveryFee || 0) > 0 && <span>Entrega {currency(order.deliveryFee)}</span>}
                    </div>

                    <div className={`order-time-line timing-${timingState}`}>
                      <span>Pedido às <strong>{orderTime}</strong></span>
                      <span aria-hidden="true">•</span>
                      <span>{elapsedLabel}</span>
                    </div>
                  </div>

                  <div className="order-queue-actions">
                    <Button type="button" variant="secondary" onClick={() => setDetailOrder(order)} disabled={actionsDisabled}>Ver detalhes</Button>
                    <Button className="order-final-action" disabled={actionsDisabled} onClick={() => runAction(`finish:${order.id}`, () => onFinalizeOrder(order.id))}>
                      {getFinalActionLabel(order)}
                    </Button>
                    <button
                      type="button"
                      className="icon-button icon-button-danger"
                      aria-label={`Excluir pedido de ${order.client}`}
                      title="Excluir pedido"
                      onClick={() => runAction(`delete:${order.id}`, () => onDeleteOrder(order.id))}
                      disabled={actionsDisabled}
                    >
                      <Icon name="trash" size={17} />
                    </button>
                  </div>
                </div>
              </article>
            )
          })}

          {!activeOrders.length && (
            <div className="empty-state compact-empty-state">
              <Icon name="orders" size={28} />
              <strong>{search ? 'Nenhum pedido ativo encontrado' : 'A fila está vazia'}</strong>
              <span>{search ? 'Ajuste sua busca para localizar outros pedidos.' : 'Novos pedidos de hoje entram aqui automaticamente em preparo.'}</span>
            </div>
          )}
        </div>
      </section>

      <section className="surface-card order-history-surface">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Histórico</span>
            <h2>Finalizados</h2>
          </div>
          <span className="toolbar-count">{finishedOrders.length} registro(s)</span>
        </div>

        <div className="order-history-list">
          {finishedOrders.slice(0, 10).map((order) => (
            <article className="order-history-row" key={order.id}>
              <div className="order-history-number">#{orderNumber(order.id)}</div>
              <div className="order-history-main">
                <strong>{order.client}</strong>
                <span>{getOrderItemsSummary(order)} · {order.type} · {formatOrderDate(order.orderDate)}</span>
              </div>
              <div className="order-history-badges">
                <StatusBadge status="Finalizado" />
                <PaymentBadge order={order} />
              </div>
              <div className="order-history-value">
                <strong>{currency(order.total)}</strong>
                <span>{finishedTime(order)}</span>
              </div>
              <div className="order-history-actions">
                <Button type="button" variant="secondary" onClick={() => setDetailOrder(order)}>Ver detalhes</Button>
                <button
                  type="button"
                  className="icon-button icon-button-danger"
                  aria-label={`Excluir pedido finalizado de ${order.client}`}
                  title="Excluir pedido"
                  onClick={() => runAction(`delete:${order.id}`, () => onDeleteOrder(order.id))}
                  disabled={actionsDisabled}
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </article>
          ))}

          {!finishedOrders.length && (
            <div className="empty-state compact-empty-state">
              <strong>Nenhum pedido finalizado</strong>
              <span>Os pedidos sairão da fila de preparo e aparecerão aqui após a ação final ou quando forem lançados com uma data anterior.</span>
            </div>
          )}
        </div>
      </section>

      {detailOrder && <OrderDetail order={detailOrder} currency={currency} onClose={() => setDetailOrder(null)} />}
    </>
  )
}

export default Orders
