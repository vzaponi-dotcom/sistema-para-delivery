import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AreaNavigation from '../../navigation/AreaNavigation.jsx'
import { buildKitchenQueueModel } from '../../../domains/orders/index.js'
import Button from '../../../shared/ui/Button.jsx'
import BottomSheet from '../../../shared/ui/BottomSheet.jsx'
import { formatOrderDisplayNumber } from '../../../../shared/orderDisplayNumber.js'
import * as defaultApi from './kitchenTvControlApi.js'
import {
  countKitchenTvOffscreen,
  isKitchenTvTelemetryFresh,
  kitchenTvOperationalStatus,
  kitchenTvVisibility,
  shortKitchenTvClientName,
} from './kitchenTvControlPresentation.js'
import './kitchenTvControl.css'

const CONTROL_POLL_MS = 2000

const telemetryTime = (telemetry) => {
  if (!telemetry?.reportedAt) return 'Sem telemetria recente'
  const date = new Date(telemetry.reportedAt)
  if (Number.isNaN(date.getTime())) return 'Sem telemetria recente'
  return `Último sinal ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date)}`
}

const withHiddenOrder = (state, orderId, hidden) => {
  if (!state) return state
  const ids = new Set((state.hiddenOrderIds || []).map(String))
  if (hidden) ids.add(String(orderId))
  else ids.delete(String(orderId))
  return { ...state, hiddenOrderIds: [...ids] }
}

function SummaryTile({ label, value }) {
  return <article><span>{label}</span><strong>{value}</strong></article>
}

function KitchenTvControlSurface({
  orders = [],
  now = new Date(),
  currentTiming,
  granted = new Set(),
  isOnline = true,
  api = defaultApi,
  onSelectOrder,
  onNavigate,
  onFeedback,
}) {
  const [controlState, setControlState] = useState(null)
  const [loading, setLoading] = useState(isOnline)
  const [error, setError] = useState('')
  const [pendingRevision, setPendingRevision] = useState(null)
  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const [pendingOrderId, setPendingOrderId] = useState(null)
  const [actionError, setActionError] = useState('')
  const [actionFeedback, setActionFeedback] = useState('')
  const [undoAction, setUndoAction] = useState(null)
  const pendingOrderRef = useRef(null)

  const canControl = granted instanceof Set && granted.has('orders.kitchen.control')
  const queueModel = useMemo(
    () => buildKitchenQueueModel(orders, now, '', currentTiming),
    [currentTiming, now, orders],
  )
  const selectedEntry = useMemo(
    () => selectedOrderId
      ? queueModel.preparing.find(({ order }) => String(order.id) === String(selectedOrderId)) ?? null
      : null,
    [queueModel.preparing, selectedOrderId],
  )

  const loadControl = useCallback(async (silent = false) => {
    if (!isOnline) {
      setLoading(false)
      return null
    }
    if (!silent) setLoading(true)
    try {
      const next = await api.getKitchenTvControl()
      if (!(silent && pendingOrderRef.current)) {
        setControlState(next)
        setError('')
      }
      return next
    } catch (cause) {
      if (!silent) setError(cause?.message || 'Não foi possível carregar o controle da TV.')
      return null
    } finally {
      if (!silent) setLoading(false)
    }
  }, [api, isOnline])

  useEffect(() => {
    if (!isOnline) {
      setLoading(false)
      setError('')
      return undefined
    }
    void loadControl()
    const interval = globalThis.setInterval(() => { void loadControl(true) }, CONTROL_POLL_MS)
    return () => globalThis.clearInterval(interval)
  }, [isOnline, loadControl])

  useEffect(() => {
    if (selectedOrderId && !selectedEntry) {
      setSelectedOrderId(null)
      setUndoAction(null)
      setActionError('')
      setActionFeedback('')
    }
  }, [selectedEntry, selectedOrderId])

  const telemetryFresh = Boolean(
    isOnline
      && controlState?.paired
      && isKitchenTvTelemetryFresh(controlState?.telemetry, now),
  )
  const currentPage = telemetryFresh ? Number(controlState?.telemetry?.currentPage) || 1 : 1
  const pageCount = telemetryFresh ? Math.max(1, Number(controlState?.telemetry?.pageCount) || 1) : 1
  const operationalControlsEnabled = Boolean(
    canControl
      && isOnline
      && controlState?.paired
      && telemetryFresh
      && pendingRevision === null
      && pendingOrderId === null,
  )

  useEffect(() => {
    if (pendingRevision === null) return
    const applied = Number(controlState?.telemetry?.appliedRevision)
    if (Number.isSafeInteger(applied) && applied >= pendingRevision) setPendingRevision(null)
  }, [controlState?.telemetry?.appliedRevision, pendingRevision])

  const requestPage = async (page) => {
    if (!operationalControlsEnabled || !Number.isSafeInteger(page) || page < 1 || page > pageCount) return false
    const expectedRevision = Math.max(0, Number(controlState?.control?.revision) || 0) + 1
    setPendingRevision(expectedRevision)
    setError('')
    try {
      const next = await api.setKitchenTvPage(page)
      setControlState(next)
      const actualRevision = Number(next?.control?.revision)
      setPendingRevision(Number.isSafeInteger(actualRevision) ? actualRevision : expectedRevision)
      return true
    } catch (cause) {
      setPendingRevision(null)
      const message = cause?.message || 'Não foi possível atualizar a TV.'
      setError(message)
      onFeedback?.(message)
      return false
    }
  }

  const reconcileOrderVisibility = async () => {
    try {
      const next = await api.getKitchenTvControl()
      setControlState(next)
      return next
    } catch {
      return null
    }
  }

  const changeOrderVisibility = async (orderId, hidden, { offerUndo = true } = {}) => {
    if (!operationalControlsEnabled || !orderId) return false
    const normalizedId = String(orderId)
    const previousState = controlState
    pendingOrderRef.current = normalizedId
    setPendingOrderId(normalizedId)
    setActionError('')
    setActionFeedback('')
    setControlState((current) => withHiddenOrder(current, normalizedId, hidden))

    try {
      if (hidden) await api.hideKitchenTvOrder(normalizedId)
      else await api.restoreKitchenTvOrder(normalizedId)

      const reconciled = await reconcileOrderVisibility()
      if (!reconciled) setControlState((current) => withHiddenOrder(current, normalizedId, hidden))

      const message = hidden ? 'Pedido retirado da TV.' : 'Pedido voltou para a TV.'
      setActionFeedback(message)
      setUndoAction(offerUndo ? { orderId: normalizedId, hidden } : null)
      onFeedback?.(message)
      return true
    } catch (cause) {
      const reconciled = await reconcileOrderVisibility()
      if (!reconciled) setControlState(previousState)
      const message = cause?.message || (hidden ? 'Não foi possível retirar o pedido da TV.' : 'Não foi possível devolver o pedido para a TV.')
      setActionError(message)
      setUndoAction(null)
      onFeedback?.(message)
      return false
    } finally {
      pendingOrderRef.current = null
      setPendingOrderId(null)
    }
  }

  const undoLastAction = async () => {
    if (!undoAction || pendingOrderId !== null) return false
    const action = undoAction
    setUndoAction(null)
    return changeOrderVisibility(action.orderId, !action.hidden, { offerUndo: false })
  }

  const openOrderActions = (entry) => {
    setSelectedOrderId(String(entry.order.id))
    setActionError('')
    setActionFeedback('')
    setUndoAction(null)
    onSelectOrder?.(entry.order)
  }

  const closeOrderActions = () => {
    if (pendingOrderId !== null) return
    setSelectedOrderId(null)
    setActionError('')
    setActionFeedback('')
    setUndoAction(null)
  }

  const offscreenCount = countKitchenTvOffscreen(queueModel.preparing, controlState, telemetryFresh)
  const lateCount = queueModel.preparing.filter(({ timingState }) => timingState === 'late' || timingState === 'very-late').length

  const connectionLabel = !isOnline
    ? 'Sem conexão'
    : !controlState?.paired
      ? 'TV não pareada'
      : telemetryFresh
        ? 'TV conectada'
        : 'TV sem sinal'
  const connectionClass = telemetryFresh
    ? 'kitchen-tv-control-connection is-live'
    : 'kitchen-tv-control-connection is-offline'

  const selectedHidden = Boolean(
    selectedEntry
      && (controlState?.hiddenOrderIds || []).some((id) => String(id) === String(selectedEntry.order.id)),
  )
  const selectedActionDisabled = !operationalControlsEnabled || pendingOrderId !== null

  return <div className="kitchen-tv-control-page">
    <AreaNavigation area="orders" />

    <header className="kitchen-tv-control-header">
      <div className="kitchen-tv-control-heading">
        <p>Operação</p>
        <h1>Controle da TV</h1>
        <small>{telemetryTime(controlState?.telemetry)}</small>
      </div>
      <span className={connectionClass}>{connectionLabel}</span>
    </header>

    {!canControl && <p className="kitchen-tv-control-readonly">Somente leitura</p>}
    {!isOnline && <p className="kitchen-tv-control-state">Sem conexão. Os controles da TV ficam indisponíveis até o celular voltar a ficar online.</p>}
    {loading && <p className="kitchen-tv-control-state" aria-live="polite">Carregando controle da TV…</p>}
    {error && <p className="kitchen-tv-control-state is-error" role="alert">{error}</p>}
    {!loading && isOnline && controlState && !controlState.paired && <p className="kitchen-tv-control-state">A TV não está pareada. Conecte-a em Configurações → TV da Cozinha para liberar os controles.</p>}

    <section className="kitchen-tv-control-paging" aria-label="Navegação da TV">
      <div className="kitchen-tv-control-page-state">
        <strong>{telemetryFresh ? `Tela ${currentPage} de ${pageCount}` : 'TV sem sinal'}</strong>
        <span aria-live="polite">{pendingRevision !== null ? 'Atualizando TV…' : ' '}</span>
      </div>
      <button
        type="button"
        className="kitchen-tv-control-page-button"
        disabled={!operationalControlsEnabled || currentPage <= 1}
        onClick={() => { void requestPage(currentPage - 1) }}
      >Anterior</button>
      <button
        type="button"
        className="kitchen-tv-control-page-button"
        disabled={!operationalControlsEnabled || currentPage <= 1}
        onClick={() => { void requestPage(1) }}
      >Início</button>
      <button
        type="button"
        className="kitchen-tv-control-page-button"
        disabled={!operationalControlsEnabled || currentPage >= pageCount}
        onClick={() => { void requestPage(currentPage + 1) }}
      >Próxima</button>
    </section>

    <section className="kitchen-tv-control-summary" aria-label="Resumo do controle da TV">
      <SummaryTile label="Em preparo" value={queueModel.preparing.length} />
      <SummaryTile label="Atrasados" value={lateCount} />
      <SummaryTile label="Agendados" value={queueModel.counts.scheduled} />
      <SummaryTile label="Fora da tela" value={offscreenCount === null ? '—' : offscreenCount} />
    </section>

    <section className="kitchen-tv-control-grid" aria-label="Pedidos em preparo">
      {queueModel.preparing.map((entry) => {
        const status = kitchenTvOperationalStatus(entry, now)
        const visibility = kitchenTvVisibility({
          orderId: entry.order.id,
          hiddenOrderIds: controlState?.hiddenOrderIds,
          telemetry: controlState?.telemetry,
          telemetryFresh,
        })
        const isPending = String(pendingOrderId || '') === String(entry.order.id)
        return <button
          key={entry.order.id}
          type="button"
          className={`kitchen-tv-control-order-card${isPending ? ' is-pending' : ''}`}
          aria-label={`${formatOrderDisplayNumber(entry.order)}, ${shortKitchenTvClientName(entry.order.client)}, ${status.label}, ${visibility.label}`}
          aria-haspopup="dialog"
          aria-busy={isPending || undefined}
          onClick={() => openOrderActions(entry)}
        >
          <span className="kitchen-tv-control-order-card-heading">
            <strong>{formatOrderDisplayNumber(entry.order)}</strong>
            <span>{shortKitchenTvClientName(entry.order.client)}</span>
          </span>
          <span className="kitchen-tv-control-badges">
            <span className={`kitchen-tv-control-badge status-${status.key}`}>{status.label}</span>
            <span className={`kitchen-tv-control-badge visibility-${visibility.key}`}>{visibility.label}</span>
          </span>
        </button>
      })}
      {!queueModel.preparing.length && <p className="kitchen-tv-control-empty">Nenhum pedido em preparo agora.</p>}
    </section>

    <BottomSheet
      open={Boolean(selectedEntry)}
      title={selectedEntry ? formatOrderDisplayNumber(selectedEntry.order) : 'Pedido'}
      onClose={closeOrderActions}
    >
      {selectedEntry && <div className="kitchen-tv-control-action-sheet">
        <div className="kitchen-tv-control-action-order">
          <strong>{selectedEntry.order.client || 'Cliente'}</strong>
          <span>{selectedHidden ? 'Retirado da TV' : 'Pedido ativo no painel'}</span>
        </div>
        <p className="kitchen-tv-control-action-explainer">Remove apenas do painel da TV. O pedido continua em preparo no sistema.</p>
        {!canControl && <p className="kitchen-tv-control-action-note">Somente leitura. Você não tem permissão para alterar a TV.</p>}
        {canControl && (!isOnline || !controlState?.paired || !telemetryFresh) && <p className="kitchen-tv-control-action-note">A TV precisa estar conectada e com sinal recente para alterar a visibilidade.</p>}
        {actionError && <p className="kitchen-tv-control-action-error" role="alert">{actionError}</p>}
        {actionFeedback && <div className="kitchen-tv-control-action-feedback" role="status">
          <span>{actionFeedback}</span>
          {undoAction?.orderId === String(selectedEntry.order.id) && <button type="button" onClick={() => { void undoLastAction() }} disabled={pendingOrderId !== null}>Desfazer</button>}
        </div>}
        <div className="kitchen-tv-control-action-buttons">
          <Button
            type="button"
            variant={selectedHidden ? 'secondary' : 'primary'}
            disabled={selectedActionDisabled}
            onClick={() => { void changeOrderVisibility(selectedEntry.order.id, !selectedHidden) }}
          >
            {pendingOrderId === String(selectedEntry.order.id)
              ? 'Atualizando…'
              : selectedHidden
                ? 'Voltar para a TV'
                : 'Retirar da TV'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pendingOrderId !== null}
            onClick={() => {
              setSelectedOrderId(null)
              onNavigate?.('orders')
            }}
          >Ver na Cozinha</Button>
        </div>
      </div>}
    </BottomSheet>
  </div>
}

export default KitchenTvControlSurface
