import { useMemo, useState } from 'react'
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
import { buildKitchenQueueModel } from '../utils/kitchenQueue.js'
import { formatOrderDisplayNumber } from '../../shared/orderDisplayNumber.js'


function Orders({ orders, now, search, onSearchChange, currency, onNewOrder, onFinalizeOrder, onCancelOrder, onNavigateHistory, onNavigatePrintQueue, newOrderIds = new Set(), soundEnabled = true, onSoundEnabledChange, printing, onToast }) {
  const [pendingAction, setPendingAction] = useState(null)
  const [detailOrder, setDetailOrder] = useState(null)
  const [cancelOrder, setCancelOrder] = useState(null)
  const [finalizeCandidate, setFinalizeCandidate] = useState(null)
  const writeDisabled = typeof navigator !== 'undefined' && !navigator.onLine
  const actionsDisabled = writeDisabled || pendingAction !== null
  const queueModel = useMemo(() => buildKitchenQueueModel(orders, now, search), [orders, now, search])
  const detailPrintJob = detailOrder ? printing?.latestJobByOrderId?.get?.(String(detailOrder.id)) || null : null

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

  return (
    <div className="kitchen-page">
      <PageHeader
        eyebrow="Operação"
        title="Cozinha"
        description="Acompanhe os pedidos em preparo e agendados"
        actions={(
          <div className="kitchen-header-actions">
            <button type="button" className="button button-secondary kitchen-sound-toggle" aria-pressed={soundEnabled} title={soundEnabled ? 'Desativar som de novos pedidos' : 'Ativar som de novos pedidos'} onClick={() => onSoundEnabledChange?.(!soundEnabled)}>
              <Icon name={soundEnabled ? 'volume-on' : 'volume-off'} size={17} />
              <span>{soundEnabled ? 'Som ativado' : 'Som desligado'}</span>
            </button>
            <Button type="button" variant="secondary" onClick={onNavigatePrintQueue}>Impressão</Button>
            <Button type="button" variant="secondary" onClick={navigateHistory}>Histórico</Button>
            <Button icon="plus" onClick={onNewOrder} disabled={actionsDisabled}>Novo pedido</Button>
          </div>
        )}
      />

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
            <span className="kitchen-queue-help">Mais antigos primeiro</span>
          </div>
          <div className="kitchen-ticket-list">
            {queueModel.preparing.map((entry) => (
              <div className={`kitchen-ticket-shell${entry.isLate ? ' kitchen-ticket-late' : ''}`} key={entry.order.id}>
                <KitchenTicket
                  entry={entry}
                  now={now}
                  disabled={actionsDisabled}
                  highlighted={newOrderIds.has(String(entry.order.id))}
                  onDetails={setDetailOrder}
                  onFinalize={setFinalizeCandidate}
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
                  disabled={actionsDisabled}
                  highlighted={newOrderIds.has(String(entry.order.id))}
                  onDetails={setDetailOrder}
                  onCancel={setCancelOrder}
                />
              </div>
            ))}
            {!queueModel.scheduled.length && <div className="kitchen-queue-empty"><Icon name="clock" size={24} /><strong>Nenhum pedido agendado aguardando preparo.</strong><span>{search ? 'Nenhum resultado nesta fila para a busca atual.' : 'Os próximos pedidos agendados aparecem aqui.'}</span></div>}
          </div>
        </section>
      </section>

      {detailOrder && <OrderDetail order={detailOrder} currency={currency} printing={printing} printJob={detailPrintJob} onClose={() => setDetailOrder(null)} onRequestCancel={() => { setDetailOrder(null); setCancelOrder(detailOrder) }} onToast={onToast} />}
      {finalizeCandidate && (
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
      <CancelOrderDialog open={Boolean(cancelOrder)} order={cancelOrder} onClose={() => setCancelOrder(null)} onConfirm={confirmCancellation} submitting={Boolean(cancelOrder && pendingAction === `cancel:${cancelOrder.id}`)} />
    </div>
  )
}

export default Orders
