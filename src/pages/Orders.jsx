import { Fragment, useMemo, useState } from 'react'
import '../order-operations.css'
import '../order-operations-compact.css'
import Button from '../components/Button'
import CancelOrderDialog from '../components/CancelOrderDialog'
import ConfirmationDialog from '../components/ConfirmationDialog'
import Icon from '../components/Icon'
import OrderDetail from '../components/OrderDetail'
import PageHeader from '../components/PageHeader'
import PaymentBadge from '../components/PaymentBadge'
import PrintingSettings from '../components/PrintingSettings'
import PrintStatusBadge from '../components/PrintStatusBadge'
import StatCard from '../components/StatCard'
import StatusBadge from '../components/StatusBadge'
import { getOrderItemDisplayName, getOrderItems, getOrderItemsSearchText } from '../utils/orderCart.js'
import { isOrderActive } from '../utils/orderLifecycle.js'
import { getOperationalStartAt, isScheduledWaiting } from '../../shared/orderTiming.js'
import {
  formatElapsedDuration,
  formatOrderDate,
  formatOrderTime,
  getElapsedMinutes,
  getFinalActionLabel,
  getOrderTimingState,
  getOrderUrgency,
  isFinishedToday,
} from '../utils/orderWorkflow'

const orderNumber = (id) => String(id).slice(-4)
const timingLabels = { 'on-time': 'No prazo', late: 'Atrasado', 'very-late': 'Muito atrasado' }

function Orders({ orders, now, search, onSearchChange, currency, onNewOrder, onFinalizeOrder, onCancelOrder, onNavigateHistory, newOrderIds = new Set(), soundEnabled = true, onSoundEnabledChange, printing }) {
  const [pendingAction, setPendingAction] = useState(null)
  const [detailOrder, setDetailOrder] = useState(null)
  const [cancelOrder, setCancelOrder] = useState(null)
  const [finalizeCandidate, setFinalizeCandidate] = useState(null)
  const [expandedOrderIds, setExpandedOrderIds] = useState(() => new Set())
  const [showPrintingSettings, setShowPrintingSettings] = useState(false)
  const writeDisabled = typeof navigator !== 'undefined' && !navigator.onLine
  const actionsDisabled = writeDisabled || pendingAction !== null

  const runAction = async (key, action) => {
    if (actionsDisabled) return
    setPendingAction(key)
    try { await action() } finally { setPendingAction(null) }
  }

  const confirmFinalize = async () => {
    if (!finalizeCandidate || actionsDisabled) return
    const order = finalizeCandidate
    await runAction(`finish:${order.id}`, async () => {
      await onFinalizeOrder(order.id)
      setFinalizeCandidate(null)
    })
  }

  const toggleOrderItems = (orderId) => {
    setExpandedOrderIds((current) => {
      const next = new Set(current)
      if (next.has(orderId)) next.delete(orderId)
      else next.add(orderId)
      return next
    })
  }

  const navigateHistory = () => {
    if (onNavigateHistory) onNavigateHistory()
    else if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('app:navigate', { detail: 'history' }))
  }

  const confirmCancellation = async (payload) => {
    if (!cancelOrder || actionsDisabled || !onCancelOrder) return
    const id = cancelOrder.id
    setPendingAction(`cancel:${id}`)
    try {
      const saved = await onCancelOrder(id, payload)
      if (saved !== false) setCancelOrder(null)
    } finally {
      setPendingAction(null)
    }
  }

  const normalizedSearch = search.trim().toLowerCase()
  const activeOrders = useMemo(() => orders
    .filter(isOrderActive)
    .filter((order) => !normalizedSearch || [order.client, order.type, order.orderDate, getOrderItemsSearchText(order), order.status, order.paymentStatus, order.paymentMethod].join(' ').toLowerCase().includes(normalizedSearch))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()), [normalizedSearch, orders])

  const scheduledOrders = useMemo(() => activeOrders.filter((order) => isScheduledWaiting(order, now)).sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor)), [activeOrders, now])
  const preparingOrders = useMemo(() => activeOrders.filter((order) => !isScheduledWaiting(order, now)).sort((a, b) => getOperationalStartAt(a) - getOperationalStartAt(b)), [activeOrders, now])

  const activeCount = preparingOrders.length
  const scheduledCount = scheduledOrders.length
  const delayedCount = orders.filter((order) => isOrderActive(order) && getOrderTimingState(order, now) !== 'on-time').length
  const finishedTodayCount = orders.filter((order) => order.status === 'Finalizado' && isFinishedToday(order, now)).length
  const detailPrintJob = detailOrder ? printing?.latestJobByOrderId?.get?.(String(detailOrder.id)) || null : null

  return (
    <>
      <PageHeader
        eyebrow="Operação"
        title="Pedidos em preparo"
        description="Acompanhe a fila pela hora real de entrada. Todos os itens e observações ficam visíveis para a cozinha."
        actions={(
          <div className="kitchen-header-actions">
            <button type="button" className="button button-secondary kitchen-sound-toggle" aria-pressed={soundEnabled} title={soundEnabled ? 'Desativar som de novos pedidos' : 'Ativar som de novos pedidos'} onClick={() => onSoundEnabledChange?.(!soundEnabled)}>
              <span aria-hidden="true">{soundEnabled ? '🔊' : '🔇'}</span><span>{soundEnabled ? 'Som ativado' : 'Som desligado'}</span>
            </button>
            <Button type="button" variant="secondary" onClick={() => setShowPrintingSettings(true)}>Impressão</Button>
            <Button type="button" variant="secondary" onClick={navigateHistory}>Ver histórico</Button>
            <Button icon="plus" onClick={onNewOrder} disabled={actionsDisabled}>Novo pedido</Button>
          </div>
        )}
      />

      <section className="stats-grid stats-grid-four order-ops-stats" aria-label="Resumo dos pedidos">
        <StatCard label="Em preparo" value={activeCount} helper="Pedidos ativos agora" icon="receipt" />
        <StatCard label="Agendados" value={scheduledCount} helper="Aguardando janela operacional" icon="orders" />
        <StatCard label="Com atraso" value={delayedCount} helper="Pedidos fora do prazo" icon="orders" tone={delayedCount ? 'danger' : 'neutral'} />
        <StatCard label="Finalizados hoje" value={finishedTodayCount} helper="Já saíram da operação" icon="dashboard" tone="success" />
      </section>

      <section className="surface-card order-ops-surface">
        <div className="toolbar">
          <label className="search-control"><Icon name="search" size={18} /><input type="search" placeholder="Buscar cliente, produto, pagamento ou tipo" value={search} onChange={(event) => onSearchChange(event.target.value)} /></label>
          <span className="toolbar-count">{activeOrders.length} na fila</span>
        </div>
        <div className="section-heading order-queue-heading"><div><span className="section-kicker">Cozinha</span><h2>Em preparo</h2></div><span className="order-queue-help">Mais antigos aparecem primeiro</span></div>

        <div className="order-queue">
          {[...preparingOrders, ...scheduledOrders].map((order, index) => {
            const waiting = isScheduledWaiting(order, now)
            const elapsed = waiting ? 0 : getElapsedMinutes(order, now)
            const urgency = getOrderUrgency(order, now)
            const timingState = getOrderTimingState(order, now)
            const timingLabel = timingLabels[timingState]
            const orderTime = formatOrderTime(order.createdAt)
            const elapsedLabel = formatElapsedDuration(elapsed)
            const orderItems = getOrderItems(order)
            const itemsExpanded = expandedOrderIds.has(order.id)
            const itemsRegionId = `order-items-${order.id}`
            const isNewArrival = newOrderIds.has(String(order.id))
            const printJob = printing?.latestJobByOrderId?.get?.(String(order.id)) || null

            return (
              <Fragment key={order.id}>
              {index === preparingOrders.length && scheduledOrders.length > 0 && <div className="section-heading order-queue-heading"><div><span className="section-kicker">Aguardando janela</span><h2>Agendados</h2></div></div>}
              <article className={`order-queue-card urgency-${urgency}${isNewArrival ? ' order-new-arrival' : ''}`} key={order.id}>
                <div className={`order-timing-marker timing-${timingState}`} title={`${timingLabel}. Pedido registrado às ${orderTime}.`}><span className="order-timing-dot" aria-hidden="true" /><strong>{timingLabel}</strong></div>
                <div className="order-queue-body">
                  <div className="order-queue-number">#{orderNumber(order.id)}</div>
                  <div className="order-queue-main">
                    <div className="order-queue-title"><div><strong>{order.client}</strong><span>{order.type} · {currency(order.total)}</span></div><div className="order-queue-badges"><StatusBadge status={waiting ? 'Agendado' : 'Em preparo'} /><PaymentBadge order={order} />{printJob && <PrintStatusBadge job={printJob} />}</div></div>
                    <button type="button" className="order-items-toggle" aria-expanded={itemsExpanded} aria-controls={itemsRegionId} onClick={() => toggleOrderItems(order.id)}><Icon name={itemsExpanded ? 'arrow-up' : 'arrow-down'} size={15} />{itemsExpanded ? `Ocultar itens (${orderItems.length})` : `Ver itens (${orderItems.length})`}</button>
                    {itemsExpanded && <div className="order-items-list" id={itemsRegionId}>{orderItems.map((item) => <div className="order-item-line" key={item.id || item.lineId || `${item.productId}-${item.name}-${item.note}`}><strong>{item.quantity}x {getOrderItemDisplayName(item)}</strong>{item.note && <span>↳ {item.note}</span>}</div>)}</div>}
                    <div className="order-queue-meta"><span>{formatOrderDate(order.orderDate)}</span>{Number(order.deliveryFee || 0) > 0 && <span>Entrega {currency(order.deliveryFee)}</span>}</div>
                    <div className={`order-time-line timing-${timingState}`}>{waiting ? <span>Desejado <strong>{formatOrderTime(order.scheduledFor)}</strong></span> : <><span>Pedido às <strong>{orderTime}</strong></span><span aria-hidden="true">•</span><span>{elapsedLabel === 'agora' ? elapsedLabel : `há ${elapsedLabel}`}</span></>}</div>
                  </div>
                  <div className="order-queue-actions">
                    <Button type="button" variant="secondary" onClick={() => setDetailOrder(order)} disabled={actionsDisabled}>Ver detalhes</Button>
                    {!waiting && <Button className="order-final-action" disabled={actionsDisabled} onClick={() => setFinalizeCandidate(order)}>{getFinalActionLabel(order)}</Button>}
                    <Button type="button" variant="secondary" className="button-danger-outline order-cancel-action" onClick={() => setCancelOrder(order)} disabled={actionsDisabled}>Cancelar pedido</Button>
                  </div>
                </div>
              </article>
              </Fragment>
            )
          })}
          {!activeOrders.length && <div className="empty-state compact-empty-state"><Icon name="orders" size={28} /><strong>{search ? 'Nenhum pedido ativo encontrado' : 'A fila está vazia'}</strong><span>{search ? 'Ajuste sua busca para localizar outros pedidos.' : 'Novos pedidos de hoje entram aqui automaticamente em preparo.'}</span></div>}
        </div>
      </section>
      {detailOrder && <OrderDetail order={detailOrder} currency={currency} printing={printing} printJob={detailPrintJob} onClose={() => setDetailOrder(null)} />}
      {showPrintingSettings && <PrintingSettings printing={printing} onClose={() => setShowPrintingSettings(false)} />}
      {finalizeCandidate && (
        <ConfirmationDialog
          title="Confirmar finalização"
          message={`O pedido #${orderNumber(finalizeCandidate.id)} de ${finalizeCandidate.client} sairá da fila de preparo. Confirme antes de continuar.`}
          confirmLabel="Confirmar finalização"
          confirmVariant="primary"
          onClose={() => setFinalizeCandidate(null)}
          onConfirm={confirmFinalize}
          disabled={actionsDisabled}
        />
      )}
      <CancelOrderDialog open={Boolean(cancelOrder)} order={cancelOrder} onClose={() => setCancelOrder(null)} onConfirm={confirmCancellation} submitting={Boolean(cancelOrder && pendingAction === `cancel:${cancelOrder.id}`)} />
    </>
  )
}

export default Orders
