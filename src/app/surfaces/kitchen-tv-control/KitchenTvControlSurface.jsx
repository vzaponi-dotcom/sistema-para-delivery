import { useCallback, useEffect, useMemo, useState } from 'react'
import AreaNavigation from '../../navigation/AreaNavigation.jsx'
import { buildKitchenQueueModel } from '../../../domains/orders/domain/kitchenQueue.js'
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
  onFeedback,
}) {
  const [controlState, setControlState] = useState(null)
  const [loading, setLoading] = useState(isOnline)
  const [error, setError] = useState('')
  const [pendingRevision, setPendingRevision] = useState(null)

  const canControl = granted instanceof Set && granted.has('orders.kitchen.control')
  const queueModel = useMemo(
    () => buildKitchenQueueModel(orders, now, '', currentTiming),
    [currentTiming, now, orders],
  )

  const loadControl = useCallback(async (silent = false) => {
    if (!isOnline) {
      setLoading(false)
      return null
    }
    if (!silent) setLoading(true)
    try {
      const next = await api.getKitchenTvControl()
      setControlState(next)
      setError('')
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
      && pendingRevision === null,
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
        return <button
          key={entry.order.id}
          type="button"
          className="kitchen-tv-control-order-card"
          aria-label={`${formatOrderDisplayNumber(entry.order)}, ${shortKitchenTvClientName(entry.order.client)}, ${status.label}, ${visibility.label}`}
          onClick={() => onSelectOrder?.(entry.order)}
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
  </div>
}

export default KitchenTvControlSurface
