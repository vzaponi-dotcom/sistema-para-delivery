import { useEffect, useMemo, useState } from 'react'
import '../order-operations.css'
import '../order-operations-compact.css'
import Button from '../components/Button'
import CancelOrderDialog from '../components/CancelOrderDialog'
import ConfirmationDialog from '../components/ConfirmationDialog'
import Icon from '../components/Icon'
import KitchenTicket from '../components/KitchenTicket'
import OrderDetail from '../components/OrderDetail'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import AreaNavigation from '../components/AreaNavigation'
import { buildKitchenQueueModel } from '../utils/kitchenQueue.js'
import { canReceiveStandaloneOrder } from '../utils/orderPaymentEligibility.js'
import { formatOrderDisplayNumber } from '../../shared/orderDisplayNumber.js'


function Orders({ orders, officialOrders = orders, now, search, onSearchChange, currency, onNewOrder, onFinalizeOrder, onCancelOrder, onRegisterPayment, paymentDisabled = false, onNavigate, onNavigatePrintQueue, granted, implemented, newOrderIds = new Set(), soundEnabled = true, onSoundEnabledChange, printing, onToast, canCreateOrders = true, canFinalizeOrders = true, canCancelOrders = true, canRefundPayments = true, canUseLocalPreferences = true, canViewPrintQueue = true, canExecutePrinting = true }) {
  const [pendingAction, setPendingAction] = useState(null)
  const [detailOrderId, setDetailOrderId] = useState(null)
  const [cancelOrder, setCancelOrder] = useState(null)
  const [finalizeCandidate, setFinalizeCandidate] = useState(null)
  const writeDisabled = typeof navigator !== 'undefined' && !navigator.onLine
  const actionsDisabled = writeDisabled || pendingAction !== null
  const queueModel = useMemo(() => buildKitchenQueueModel(orders, now, search), [orders, now, search])
  const detailOrder = detailOrderId ? officialOrders.find((order) => order.id === detailOrderId) ?? null : null
  const detailPrintJob = detailOrder ? printing?.latestJobByOrderId?.get?.(String(detailOrder.id)) || null : null

  useEffect(() => {
    if (detailOrderId && !detailOrder) setDetailOrderId(null)
  }, [detailOrder, detailOrderId])

  const runAction = async (key, action) => {
    if (actionsDisabled) return
    setPendingAction(key)
    try { await action() } finally { setPendingAction(null) }
  }

  const confirmFinalize = async () => {
    if (!canFinalizeOrders || !finalizeCandidate || actionsDisabled) return false
    const order = finalizeCandidate
    await runAction(`finish:${order.id}`, async () => {
      await onFinalizeOrder(order.id)
      setFinalizeCandidate(null)
    })
  }

  const confirmCancellation = async (payload) => {
    if (!canCancelOrders || (payload?.refundNow && !canRefundPayments) || !cancelOrder || actionsDisabled || !onCancelOrder) return false
    const id = cancelOrder.id
    setPendingAction(`cancel:${id}`)
    try {
      const saved = await onCancelOrder(id, payload)
      if (saved !== false) setCancelOrder(null)
    } finally {
      setPendingAction(null)
    }
  }

  const registerPaymentFromDetail = () => {
    if (!canReceiveStandaloneOrder(detailOrder, granted, 'orders')) return
    if (onRegisterPayment?.(detailOrder.id, 'orders')) setDetailOrderId(null)
  }

  return (
    <div className="kitchen-page">
      <PageHeader
        eyebrow="Operação"
        title="Cozinha"
        description="Acompanhe os pedidos em preparo e agendados"
        actions={(
          <div className="kitchen-header-actions">
            {canUseLocalPreferences && <button type="button" className="button button-secondary kitchen-sound-toggle" aria-pressed={soundEnabled} title={soundEnabled ? 'Desativar som de novos pedidos' : 'Ativar som de novos pedidos'} onClick={() => { if (canUseLocalPreferences) onSoundEnabledChange?.(!soundEnabled) }}>
              <Icon name={soundEnabled ? 'volume-on' : 'volume-off'} size={17} />
              <span>{soundEnabled ? 'Som ativado' : 'Som desligado'}</span>
            </button>}
            {canViewPrintQueue && <Button type="button" variant="secondary" onClick={onNavigatePrintQueue}>Fila de impressão</Button>}
            {canCreateOrders && <Button icon="plus" onClick={() => { if (canCreateOrders) onNewOrder?.() }} disabled={actionsDisabled}>Novo pedido</Button>}
          </div>
        )}
      />

      <AreaNavigation area="orders" activeTab="orders" granted={granted} implemented={implemented} onNavigate={onNavigate} />

      <section className="stats-grid stats-grid-four order-ops-stats kitchen-stats" aria-label="Resumo dos pedidos">
        <StatCard className="kitchen-stat-card kitchen-stat-preparing" label="Em preparo" value={queueModel.counts.preparing} helper="Pedidos ativos agora" icon="preparation" />
        <StatCard className="kitchen-stat-card kitchen-stat-scheduled" label="Agendados" value={queueModel.counts.scheduled} helper="Próximos pedidos" icon="clock" />
        <StatCard className="kitchen-stat-card kitchen-stat-late" label="Fora do prazo" value={queueModel.counts.late} helper="Precisam de atenção" icon="alert" tone={queueModel.counts.late ? 'danger' : 'neutral'} />
        <StatCard className="kitchen-stat-card kitchen-stat-finished" label="Finalizados hoje" value={queueModel.counts.finishedToday} helper="Já saíram da operação" icon="kitchen" tone="success" />
      </section>

      <section className="kitchen-board" aria-label="Filas da cozinha">
        <div className="kitchen-toolbar">
          <label className="search-control kitchen-search"><Icon name="search" size={18} /><input type="search" placeholder="Buscar cliente, pedido, produto ou tipo" value={search} onChange={(event) => onSearchChange(event.target.value)} /></label>
          <span className="toolbar-count">{queueModel.totalVisible} {queueModel.totalVisible === 1 ? 'pedido visível' : 'pedidos visíveis'}</span>
        </div>

        <section className="kitchen-queue-section" aria-labelledby="kitchen-preparing-heading">
          <div className="kitchen-queue-heading">
            <div><Icon name="preparation" size={18} /><h2 id="kitchen-preparing-heading">Em preparo <span>({queueModel.preparing.length})</span></h2></div>
            <span className="kitchen-queue-help">Prioridade por prazo</span>
          </div>
          <div className="kitchen-ticket-list">
            {queueModel.preparing.map((entry) => (
              <div className={`kitchen-ticket-shell${entry.isLate ? ' kitchen-ticket-late' : ''}`} key={entry.order.id}>
                <KitchenTicket
                  entry={entry}
                  now={now}
                  disabled={actionsDisabled || !canFinalizeOrders}
                  highlighted={newOrderIds.has(String(entry.order.id))}
                  onDetails={(order) => setDetailOrderId(order.id)}
                  onFinalize={(order) => { if (!canFinalizeOrders) return false; setFinalizeCandidate(order); return true }}
                />
              </div>
            ))}
            {!queueModel.preparing.length && <div className="kitchen-queue-empty"><Icon name="preparation" size={24} /><strong>Nenhum pedido em preparo agora.</strong><span>{search ? 'Nenhum resultado nesta fila para a busca atual.' : 'Novos pedidos aparecem aqui automaticamente.'}</span></div>}
          </div>
        </section>

        <section className="kitchen-queue-section" aria-labelledby="kitchen-scheduled-heading">
          <div className="kitchen-queue-heading">
            <div><Icon name="clock" size={18} /><h2 id="kitchen-scheduled-heading">Agendados para preparo <span>({queueModel.scheduled.length})</span></h2></div>
            <span className="kitchen-queue-help">Mais próximos primeiro</span>
          </div>
          <div className="kitchen-ticket-list">
            {queueModel.scheduled.map((entry) => (
              <div className={`kitchen-ticket-shell${entry.isLate ? ' kitchen-ticket-late' : ''}`} key={entry.order.id}>
                <KitchenTicket
                  entry={entry}
                  now={now}
                  disabled={actionsDisabled || !canCancelOrders}
                  highlighted={newOrderIds.has(String(entry.order.id))}
                  onDetails={(order) => setDetailOrderId(order.id)}
                  onCancel={(order) => { if (!canCancelOrders) return false; setCancelOrder(order); return true }}
                />
              </div>
            ))}
            {!queueModel.scheduled.length && <div className="kitchen-queue-empty"><Icon name="clock" size={24} /><strong>Nenhum pedido agendado aguardando preparo.</strong><span>{search ? 'Nenhum resultado nesta fila para a busca atual.' : 'Os próximos pedidos agendados aparecem aqui.'}</span></div>}
          </div>
        </section>
      </section>

      {detailOrder && <OrderDetail order={detailOrder} currency={currency} printing={printing} printJob={detailPrintJob} onClose={() => setDetailOrderId(null)} onRequestCancel={canCancelOrders ? () => { if (!canCancelOrders) return; setDetailOrderId(null); setCancelOrder(detailOrder) } : undefined} canCancelOrders={canCancelOrders} canExecutePrinting={canExecutePrinting} canRegisterPayment={canReceiveStandaloneOrder(detailOrder, granted, 'orders')} registerPaymentDisabled={paymentDisabled || actionsDisabled} onRegisterPayment={registerPaymentFromDetail} onToast={onToast} />}
      {canFinalizeOrders && finalizeCandidate && (
        <ConfirmationDialog
          title="Confirmar finalização"
          message={`${formatOrderDisplayNumber(finalizeCandidate)} de ${finalizeCandidate.client} sairá da fila de preparo. Confirme antes de continuar.`}
          confirmLabel="Confirmar finalização"
          confirmVariant="primary"
          onClose={() => setFinalizeCandidate(null)}
          onConfirm={confirmFinalize}
          disabled={actionsDisabled}
        />
      )}
      <CancelOrderDialog open={canCancelOrders && Boolean(cancelOrder)} order={cancelOrder} onClose={() => setCancelOrder(null)} onConfirm={confirmCancellation} submitting={Boolean(cancelOrder && pendingAction === `cancel:${cancelOrder.id}`)} canRefundPayments={canRefundPayments} />
    </div>
  )
}

export default Orders
