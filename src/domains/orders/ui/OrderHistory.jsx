import { useEffect, useMemo, useRef, useState } from 'react'
import '../../../order-operations.css'
import '../../../order-operations-compact.css'
import './history-redesigned.css'
import Button from '../../../shared/ui/Button'
import Modal from '../../../shared/ui/Modal'
import CancelOrderDialog from './components/CancelOrderDialog'
import Icon from '../../../shared/ui/Icon'
import OrderDetail from './components/OrderDetail'
import OrderPaymentStatus from './components/OrderPaymentStatus.jsx'
import useHistoryPrinting from './components/useHistoryPrinting.jsx'
import AreaNavigation from '../../../app/navigation/AreaNavigation.jsx'
import PageHeader from '../../../shared/ui/PageHeader'
import StatusBadge from '../../../shared/ui/StatusBadge'
import { getOrderItemsSummary } from '../domain/orderCart.js'
import { getOrderRefundState, isOrderFinished } from '../domain/orderLifecycle.js'
import { canReceiveStandaloneOrder } from '../domain/orderPaymentEligibility.js'
import { formatOrderDisplayNumber } from '../../../../shared/orderDisplayNumber.js'
import { getBusinessDate } from '../../../../shared/finance.js'
import { formatHistoryTime, getHistoryView, historyTimestamp } from '../domain/historyQuery.js'

const periods = [{ value: 'today', label: 'Hoje' }, { value: 'yesterday', label: 'Ontem' }, { value: '7d', label: 'Últimos 7 dias' }, { value: 'custom', label: 'Escolher período' }, { value: 'all', label: 'Todo o período' }]
const defaultCurrency = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))

function OrderHistory({ orders = [], currency = defaultCurrency, onCancelOrder, onRegisterPayment, paymentDisabled = false, paymentOptions, cancellationOptions = [], cancellationRevision = null, actionKey = null, printing, onToast, queryState = {}, onQueryChange, granted, canCancelOrders = true, canRefundPayments = true, canForcePrinting = false, canExecutePrinting = true, now = new Date() }) {
  const filter = queryState.filter || 'all'
  const period = queryState.period || 'all'
  const [detailOrderId, setDetailOrderId] = useState(null)
  const [cancelOrder, setCancelOrder] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [periodOpen, setPeriodOpen] = useState(false)
  const [menuOrderId, setMenuOrderId] = useState(null)
  const menuTrigger = useRef(null)
  const historyPrinting = useHistoryPrinting({ orders, printing, canExecutePrinting, canForcePrinting, onToast })
  const view = useMemo(() => getHistoryView(orders.filter(isOrderFinished), queryState, now), [orders, queryState, now])
  const terminalOrders = view.orders
  const detailOrder = detailOrderId ? orders.find(order => order.id === detailOrderId) ?? null : null
  const closeMenu = () => setMenuOrderId(null)

  useEffect(() => { if (detailOrderId && !detailOrder) setDetailOrderId(null) }, [detailOrder, detailOrderId])
  useEffect(() => {
    if (!menuOrderId) return undefined
    const outside = event => { if (!event.target?.closest?.('.history-order-menu')) setMenuOrderId(null) }
    const escape = event => { if (event.key === 'Escape') { setMenuOrderId(null); menuTrigger.current?.focus() } }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [menuOrderId])
  const openDetails = order => { closeMenu(); setDetailOrderId(order.id) }
  const confirmCancellation = async payload => {
    if (!canCancelOrders || (payload?.refundNow && !canRefundPayments) || !cancelOrder || submitting || !onCancelOrder) return false
    setSubmitting(true)
    try { const saved = await onCancelOrder(cancelOrder.id, payload); if (saved !== false) setCancelOrder(null) } finally { setSubmitting(false) }
  }
  const registerPaymentFromDetail = () => {
    if (!canReceiveStandaloneOrder(detailOrder, granted, 'history')) return
    if (onRegisterPayment?.(detailOrder.id, 'history')) setDetailOrderId(null)
  }
  const choosePeriod = value => {
    onQueryChange?.({ period: value, ...(value === 'custom' ? { startDate: queryState.startDate || getBusinessDate(now), endDate: queryState.endDate || getBusinessDate(now) } : {}) })
    setPeriodOpen(false)
  }
  return <>
    <PageHeader eyebrow="Pedidos" title="Histórico" description="Consulte pedidos finalizados e cancelados" />
    <AreaNavigation area="orders" />
    <section className="history-redesigned" aria-label="Histórico de pedidos">
      <div className="history-controls">
        <div className="history-search-row">
          <label className="search-control history-search"><Icon name="search" size={18} /><input type="search" aria-label="Buscar no histórico" placeholder="Buscar cliente, nº do pedido ou produto" value={queryState.search || ''} onChange={event => onQueryChange?.({ search: event.target.value })} /></label>
          <Button type="button" variant="secondary" icon="calendar" aria-haspopup="dialog" onClick={() => setPeriodOpen(true)}>{periods.find(p => p.value === period)?.label || 'Hoje'}<Icon name="arrow-down" size={14} /></Button>
        </div>
        {period === 'custom' && <div className="history-custom-dates"><label>De<input type="date" aria-label="Data inicial do histórico" value={queryState.startDate || ''} onChange={event => onQueryChange?.({ startDate: event.target.value })} /></label><label>Até<input type="date" aria-label="Data final do histórico" min={queryState.startDate || undefined} value={queryState.endDate || ''} onChange={event => onQueryChange?.({ endDate: event.target.value })} /></label></div>}
        {!view.validRange && <p className="history-date-error" role="alert">Informe um período válido, com a data inicial anterior ou igual à final.</p>}
        <div className="history-filter" role="group" aria-label="Filtrar histórico">{[['all', 'Todos'], ['finalized', 'Finalizados'], ['cancelled', 'Cancelados']].map(([key, label]) => <button type="button" key={key} aria-label={label} aria-pressed={filter === key} className={filter === key ? 'history-filter-button active' : 'history-filter-button'} onClick={() => onQueryChange?.({ filter: key })}><span>{label}</span><span className="history-filter-count">{view.counts[key]}</span></button>)}</div>
        <small className="history-date-hint">Período pela data de finalização ou cancelamento</small>
      </div>
      <div className="history-results-heading"><span className="toolbar-count" aria-live="polite">{terminalOrders.length} registro(s)</span><span>Mais recentes primeiro</span></div>
      <div className="order-history-list history-group-list">
        {view.groups.map(group => <section className="history-day-group" key={group.date || 'unknown'} aria-label={group.label}>
          <h2>{group.label}<span>{group.orders.length} {group.orders.length === 1 ? 'pedido' : 'pedidos'}</span></h2>
          <div className="history-day-list">
            <div className="history-column-labels" aria-hidden="true"><span>Cliente / pedido</span><span>Status</span><span>Pagamento</span><span>Valor</span><span>Ações</span></div>
            {group.orders.map(order => {
              const refundState = getOrderRefundState(order)
              const cancelReason = order.cancelReasonLabel || order.cancelReason || ''
              const printAction = historyPrinting.getPrintAction(order)
              return <article className="history-order-row" key={order.id} tabIndex={0} aria-label={`Ver detalhes do ${formatOrderDisplayNumber(order)}`} onKeyDown={event => { if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) { event.preventDefault(); openDetails(order) } }} onClick={event => { if (!event.target.closest('button, a, input, summary, [role="menu"]')) openDetails(order) }}>
                <div className="history-order-identity"><strong>{order.client || 'Cliente não identificado'}</strong><div className="history-order-meta"><span>{formatOrderDisplayNumber(order)}</span><span>·</span><span>{order.type}</span><span>·</span><time dateTime={historyTimestamp(order)} aria-label={`${order.status === 'Cancelado' ? 'Cancelado' : 'Finalizado'} às ${formatHistoryTime(historyTimestamp(order))}`}>{formatHistoryTime(historyTimestamp(order))}</time></div><span className="history-order-products">{getOrderItemsSummary(order)}</span>{order.status === 'Cancelado' && cancelReason && <small className="history-cancel-reason">Motivo: {cancelReason}{order.cancelReasonNote ? ` · ${order.cancelReasonNote}` : ''}</small>}</div>
                <div className="history-order-status"><StatusBadge status={order.status} /></div>
                <div className="history-order-payment" aria-label={refundState === 'pending' ? 'Estorno pendente' : refundState === 'refunded' ? 'Estornado' : 'Pagamento'}><OrderPaymentStatus order={order} /></div>
                <strong className="history-order-value">{currency(order.total)}</strong>
                <div className="history-order-actions">
                  <div className="history-order-menu"><button type="button" className="icon-button history-more-button" aria-label={`Mais ações do ${formatOrderDisplayNumber(order)}`} aria-haspopup="menu" aria-expanded={menuOrderId === order.id} onClick={event => { menuTrigger.current = event?.currentTarget; setMenuOrderId(menuOrderId === order.id ? null : order.id) }}><Icon name="more" size={18} /></button>
                    {menuOrderId === order.id && <div className="history-action-menu" role="menu" aria-label={`Ações do ${formatOrderDisplayNumber(order)}`}>
                      <button type="button" role="menuitem" onClick={() => openDetails(order)}><Icon name="eye" size={16} />Ver detalhes</button>
                      {printAction && <button type="button" role="menuitem" disabled={!printAction.enabled || Boolean(historyPrinting.busyOrderId)} onClick={() => { closeMenu(); return historyPrinting.requestPrint(order) }}><Icon name="printer" size={16} />{printAction.label}</button>}
                      <button type="button" role="menuitem" disabled={!canExecutePrinting || Boolean(historyPrinting.busyOrderId) || !printing?.getPreviewDocument || !printing?.downloadOrderPdf} onClick={() => { closeMenu(); return historyPrinting.generatePdf(order) }}><Icon name="note" size={16} />Gerar PDF</button>
                      {canCancelOrders && order.status === 'Finalizado' && <button type="button" role="menuitem" className="history-cancel-menu-action" disabled={Boolean(actionKey) || submitting} onClick={() => { if (canCancelOrders) { closeMenu(); setCancelOrder(order) } }}><Icon name="close" size={16} />Cancelar pedido</button>}
                    </div>}
                  </div>
                </div>
              </article>
            })}
          </div>
        </section>)}
        {!terminalOrders.length && <div className="empty-state history-empty"><Icon name="search" size={28} /><strong>Nenhum pedido encontrado</strong><span>Tente outra busca ou ajuste o período e o status.</span><Button type="button" variant="secondary" onClick={() => onQueryChange?.({ filter: 'all', search: '', period: 'all', startDate: '', endDate: '' })}>Limpar filtros</Button></div>}
      </div>
    </section>
    {periodOpen && <Modal title="Filtrar período" className="history-period-modal" onClose={() => setPeriodOpen(false)}><div className="history-period-options">{periods.map(option => <button type="button" key={option.value} className={option.value === period ? 'history-period-option active' : 'history-period-option'} aria-pressed={option.value === period} onClick={() => choosePeriod(option.value)}>{option.label}{option.value === period && <Icon name="check" size={18} />}</button>)}</div></Modal>}
    {detailOrder && <OrderDetail order={detailOrder} currency={currency} printing={printing} printJob={printing?.latestJobByOrderId?.get(detailOrder.id)} onClose={() => setDetailOrderId(null)} onRequestCancel={canCancelOrders && detailOrder.status === 'Finalizado' ? () => { if (!canCancelOrders) return; setDetailOrderId(null); setCancelOrder(detailOrder) } : undefined} canCancelOrders={canCancelOrders} canForcePrinting={canForcePrinting} canExecutePrinting={canExecutePrinting} canRegisterPayment={canReceiveStandaloneOrder(detailOrder, granted, 'history')} registerPaymentDisabled={paymentDisabled || Boolean(actionKey) || submitting} onRegisterPayment={registerPaymentFromDetail} onToast={onToast} />}
    {historyPrinting.confirmationDialog}
    <CancelOrderDialog open={canCancelOrders && Boolean(cancelOrder)} order={cancelOrder} paymentOptions={paymentOptions} reasonOptions={cancellationOptions} reasonRevision={cancellationRevision} onClose={() => setCancelOrder(null)} onConfirm={confirmCancellation} submitting={submitting} canRefundPayments={canRefundPayments} />
  </>
}
export default OrderHistory
