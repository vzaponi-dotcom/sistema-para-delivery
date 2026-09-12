import { useEffect, useMemo, useState } from 'react'
import '../../shared/finance.js'
import '../receivables.css'
import '../receivables-forecast.css'
import BottomSheet from '../components/BottomSheet'
import Button from '../components/Button'
import Icon from '../components/Icon'
import OrderDetail from '../components/OrderDetail'
import PageHeader from '../components/PageHeader'
import AreaNavigation from '../components/AreaNavigation'
import PaymentPromiseDialog from '../components/PaymentPromiseDialog'
import ReceivableDetail from '../components/ReceivableDetail'
import ReceivablesForecastDialog from '../components/ReceivablesForecastDialog'
import ReceivablesQuickPaymentDialog from '../components/ReceivablesQuickPaymentDialog'
import SystemSelect from '../components/SystemSelect'
import { getBusinessDate } from '../../shared/finance.js'
import { getOrderItemsSearchText, getOrderItemsSummary } from '../utils/orderCart.js'
import { formatOrderDate } from '../utils/orderWorkflow'
import { calculateReceivedToday } from '../utils/paymentWorkflow.js'
import {
  buildPendingReceivableEntries,
  buildReceivablesForecast,
  calculateReceivableSummary,
  getPaidReceivableOrders,
  sortReceivableEntries,
} from '../utils/receivables.js'
import { formatOrderDisplayNumber } from '../../shared/orderDisplayNumber.js'

const PRIMARY_VIEWS = ['pending', 'paid']
const TIMING_FILTERS = ['all', 'today', 'upcoming', 'overdue']
const TIMING_FILTER_LABELS = { all: 'Todos', today: 'Hoje', upcoming: 'Próximos', overdue: 'Em atraso' }
const SORT_OPTIONS = [
  { value: 'urgency', label: 'Mais urgente' },
  { value: 'recent', label: 'Mais recente' },
  { value: 'value-desc', label: 'Maior valor' },
]
const entrySearchText = (entry) => entry.orders.map((order) => [order.client, String(order.id), order.type, order.orderDate, getOrderItemsSearchText(order)].join(' ')).join(' ').toLowerCase()
const orderSearchText = (order) => [order.client, String(order.id), order.type, order.orderDate, getOrderItemsSearchText(order)].join(' ').toLowerCase()

const timingLabel = (entry) => {
  if (entry.timing.status === 'overdue') {
    const days = entry.timing.daysOverdue
    return `Atrasado há ${days} ${days === 1 ? 'dia' : 'dias'}`
  }
  if (entry.timing.status === 'today') return entry.kind === 'order' && entry.order?.promisedPaymentDate ? 'Prometido para hoje' : 'Pagamento esperado hoje'
  if (entry.timing.status === 'upcoming') {
    const prefix = entry.kind === 'order' && entry.order?.promisedPaymentDate ? 'Prometido para' : 'Previsto para'
    return `${prefix} ${formatOrderDate(entry.expectedDate)}`
  }
  return 'Pendente'
}

const paidMeta = (order) => {
  const paidAt = order.paidAt ? new Date(order.paidAt).toLocaleString('pt-BR') : 'Data não informada'
  return `Quitado · ${order.paymentMethod || 'Forma não informada'} · ${paidAt}`
}

const paidEntry = (order) => ({
  key: `paid:${order.id}`,
  kind: 'order',
  label: order.client || 'Pedido sem identificação',
  order,
  orders: [order],
  total: Number(order.total || 0),
  expectedDate: order.promisedPaymentDate || order.orderDate,
  timing: { status: 'paid', daysOverdue: 0 },
})

function Receivables({
  orders,
  movements = [],
  currency,
  disabled = false,
  canReceivePayments = true,
  canManagePaymentPromises = true,
  canExecutePrinting = true,
  onRegisterPayment,
  onUpdatePaymentPromise,
  queryState,
  onQueryChange,
  granted,
  implemented,
  onNavigate,
  activeTab,
}) {
  const { search, activeView, timingFilter, sortMode, exactDateFilter, selectedEntryKey } = queryState
  const patchQuery = (patch) => onQueryChange(patch)
  const [today, setToday] = useState(() => getBusinessDate())
  const [detailOrder, setDetailOrder] = useState(null)
  const [promiseOrder, setPromiseOrder] = useState(null)
  const [quickPaymentOpen, setQuickPaymentOpen] = useState(false)
  const [forecastOpen, setForecastOpen] = useState(false)
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)
  const [isMobileDetail, setIsMobileDetail] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 820px)').matches)
  const normalizedSearch = search.trim().toLowerCase()
  const writeDisabled = disabled || (typeof navigator !== 'undefined' && !navigator.onLine)

  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = getBusinessDate()
      setToday((current) => current === next ? current : next)
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const media = window.matchMedia('(max-width: 820px)')
    const sync = () => setIsMobileDetail(media.matches)
    sync()
    media.addEventListener?.('change', sync)
    return () => media.removeEventListener?.('change', sync)
  }, [])

  const summary = useMemo(() => calculateReceivableSummary(orders, today), [orders, today])
  const forecast = useMemo(() => buildReceivablesForecast(orders, today, 7), [orders, today])
  const receivedToday = useMemo(() => calculateReceivedToday(movements, today), [movements, today])
  const pendingEntries = useMemo(() => buildPendingReceivableEntries(orders, today), [orders, today])
  const quickPaymentEntries = useMemo(() => pendingEntries.filter((entry) => entry.kind === 'order'), [pendingEntries])
  const allPaidOrders = useMemo(() => getPaidReceivableOrders(orders), [orders])

  const visiblePendingEntries = useMemo(() => {
    const filtered = pendingEntries.filter((entry) => {
      if (normalizedSearch && !entrySearchText(entry).includes(normalizedSearch)) return false
      if (timingFilter !== 'all' && entry.timing.status !== timingFilter) return false
      if (exactDateFilter && entry.expectedDate !== exactDateFilter) return false
      return true
    })
    return sortReceivableEntries(filtered, sortMode)
  }, [pendingEntries, normalizedSearch, timingFilter, exactDateFilter, sortMode])

  const visiblePaidOrders = useMemo(() => allPaidOrders
    .filter((order) => !normalizedSearch || orderSearchText(order).includes(normalizedSearch))
    .sort((left, right) => String(right.paidAt || '').localeCompare(String(left.paidAt || ''))), [allPaidOrders, normalizedSearch])

  const selectedEntry = useMemo(() => {
    if (!selectedEntryKey) return null
    if (selectedEntryKey.startsWith('paid:')) {
      const order = allPaidOrders.find((item) => `paid:${item.id}` === selectedEntryKey)
      return order ? paidEntry(order) : null
    }
    return pendingEntries.find((entry) => entry.key === selectedEntryKey) || null
  }, [allPaidOrders, pendingEntries, selectedEntryKey])

  const overlayOpen = Boolean((selectedEntry && mobileDetailOpen && isMobileDetail) || detailOrder || promiseOrder || quickPaymentOpen || forecastOpen)

  useEffect(() => {
    if (selectedEntryKey && !selectedEntry) onQueryChange({ selectedEntryKey: null })
  }, [onQueryChange, selectedEntry, selectedEntryKey])

  const selectPrimaryView = (view) => {
    if (!PRIMARY_VIEWS.includes(view)) return
    patchQuery({ activeView: view, timingFilter: 'all', exactDateFilter: null, selectedEntryKey: null })
  }

  const applyTimingFilter = (filter) => {
    if (!TIMING_FILTERS.includes(filter)) return
    patchQuery({ activeView: 'pending', timingFilter: filter, exactDateFilter: null, selectedEntryKey: null })
  }

  const applyForecastDate = (date) => {
    patchQuery({ activeView: 'pending', timingFilter: 'all', exactDateFilter: date, selectedEntryKey: null })
    setForecastOpen(false)
  }

  const openOrderDetail = (entry) => {
    patchQuery({ selectedEntryKey: entry.key })
    setMobileDetailOpen(isMobileDetail)
  }
  const openPaidOrderDetail = (order) => {
    patchQuery({ selectedEntryKey: `paid:${order.id}` })
    setMobileDetailOpen(isMobileDetail)
  }

  const closeMobileDetail = () => {
    setMobileDetailOpen(false)
    patchQuery({ selectedEntryKey: null })
  }

  const registerPaymentFromDetail = (orderId) => {
    if (!canReceivePayments) return false
    setMobileDetailOpen(false)
    patchQuery({ selectedEntryKey: null })
    onRegisterPayment?.(orderId)
    return true
  }

  const editPaymentPromiseFromDetail = (order) => {
    if (!canManagePaymentPromises) return false
    setMobileDetailOpen(false)
    patchQuery({ selectedEntryKey: null })
    setPromiseOrder(order)
    return true
  }

  const registerQuickPayment = (orderId) => {
    if (!canReceivePayments) return false
    onRegisterPayment?.(orderId)
    return true
  }

  const viewOrderFromDetail = (order) => {
    setMobileDetailOpen(false)
    patchQuery({ selectedEntryKey: null })
    setDetailOrder(order)
  }

  const pendingIsGloballyEmpty = pendingEntries.length === 0
  const pendingHasActiveFilter = Boolean(normalizedSearch || timingFilter !== 'all' || exactDateFilter)

  const detail = selectedEntry ? (
    <ReceivableDetail
      entry={selectedEntry}
      currency={currency}
      disabled={writeDisabled}
      canReceivePayments={canReceivePayments}
      canManagePaymentPromises={canManagePaymentPromises}
      onRegisterPayment={registerPaymentFromDetail}
      onEditPaymentPromise={editPaymentPromiseFromDetail}
      onViewOrder={viewOrderFromDetail}
    />
  ) : null

  return (
    <>
      <AreaNavigation area="finance" activeTab={activeTab} granted={granted} implemented={implemented} onNavigate={onNavigate} />
      <div className="receivables-page-header">
        <PageHeader eyebrow="Financeiro" title="A receber" description="Acompanhe o que entra hoje, os próximos recebimentos e os atrasos." />
        <button
          type="button"
          className="receivables-forecast-button"
          onClick={() => setForecastOpen(true)}
          aria-label="Previsão de recebimentos"
        >
          <Icon name="chart" size={18} />
          <span>Previsão</span>
        </button>
      </div>
      <section className="receivables-summary-grid" aria-label="Resumo de recebimentos">
        <button type="button" className="receivables-summary-card" onClick={() => applyTimingFilter('today')}>
          <span className="receivables-summary-icon"><Icon name="clock" size={18} /></span><span>Receber hoje</span><strong>{currency(summary.today.amount)}</strong><small>{summary.today.count} pedido(s)</small>
        </button>
        <button type="button" className="receivables-summary-card" onClick={() => applyTimingFilter('upcoming')}>
          <span className="receivables-summary-icon"><Icon name="receipt" size={18} /></span><span>Próximos</span><strong>{currency(summary.upcoming.amount)}</strong><small>{summary.upcoming.count} recebimento(s)</small>
        </button>
        <button type="button" className="receivables-summary-card receivables-summary-card-danger" onClick={() => applyTimingFilter('overdue')}>
          <span className="receivables-summary-icon"><Icon name="alert" size={18} /></span><span>Em atraso</span><strong>{currency(summary.overdue.amount)}</strong><small>{summary.overdue.count} pendência(s)</small>
        </button>
      </section>

      <div className="receivables-workspace">
        <section className="surface-card receivables-surface">
          <div className="receivables-primary-tabs" role="group" aria-label="Situação dos recebimentos">
            <button type="button" aria-pressed={activeView === 'pending'} onClick={() => selectPrimaryView('pending')}>Pendentes</button>
            <button type="button" aria-pressed={activeView === 'paid'} onClick={() => selectPrimaryView('paid')}>Quitados</button>
          </div>

          {activeView === 'pending' && (
            <div className="receivables-filter-strip" aria-label="Filtrar pendências por prazo">
              {TIMING_FILTERS.map((filter) => <button key={filter} type="button" aria-pressed={timingFilter === filter && !exactDateFilter} onClick={() => applyTimingFilter(filter)}>{TIMING_FILTER_LABELS[filter]}</button>)}
              {exactDateFilter && <button type="button" aria-pressed="true" onClick={() => patchQuery({ exactDateFilter: null })}>Data {formatOrderDate(exactDateFilter)} ×</button>}
            </div>
          )}

          {canReceivePayments && activeView === 'pending' && (
            <div className="receivables-header-actions">
              <Button
                type="button"
                icon="plus"
                className="receivables-payment-desktop-action"
                onClick={() => setQuickPaymentOpen(true)}
                disabled={writeDisabled || quickPaymentEntries.length === 0 || !onRegisterPayment}
              >
                Registrar recebimento
              </Button>
            </div>
          )}

          <div className="receivables-controls">
            <label className="search-control"><Icon name="search" size={18} /><input type="search" placeholder="Buscar identificação, pedido ou produto" value={search} onChange={(event) => patchQuery({ search: event.target.value })} /></label>
            {activeView === 'pending' && <div className="receivables-sort-control"><span>Ordenar</span><SystemSelect label="Ordenar recebimentos" value={sortMode} options={SORT_OPTIONS} onChange={(value) => patchQuery({ sortMode: value })} /></div>}
            <span className="toolbar-count">{activeView === 'pending' ? visiblePendingEntries.length : visiblePaidOrders.length} item(ns)</span>
          </div>

          {activeView === 'pending' ? (
            <div className="receivables-ledger" aria-label="Recebimentos pendentes">
              {visiblePendingEntries.map((entry) => (
                <div className="receivable-ledger-item" key={entry.key}>
                  <button type="button" className="receivable-ledger-row" aria-pressed={selectedEntryKey === entry.key} onClick={() => openOrderDetail(entry)}>
                    <span className="receivable-ledger-avatar">{entry.label.charAt(0).toUpperCase()}</span>
                    <span className="receivable-ledger-main"><strong>{entry.label}</strong><span>{`${formatOrderDisplayNumber(entry.order)} · ${getOrderItemsSummary(entry.order)}`}</span><span className={`receivable-timing receivable-timing-${entry.timing.status}`}>{timingLabel(entry)}</span></span>
                    <strong className="receivable-ledger-amount">{currency(entry.total)}</strong><Icon name="details" size={18} />
                  </button>
                </div>
              ))}
              {!visiblePendingEntries.length && <div className="empty-state receivables-empty-state"><Icon name="wallet" size={28} /><strong>{pendingIsGloballyEmpty && !pendingHasActiveFilter ? 'Tudo recebido por aqui' : 'Nenhum recebimento neste filtro'}</strong><span>{pendingIsGloballyEmpty && !pendingHasActiveFilter ? 'Quando houver um pedido pendente, ele aparecerá automaticamente nesta tela.' : 'Tente outro período ou ajuste a busca.'}</span></div>}
            </div>
          ) : (
            <div className="receivables-ledger receivables-ledger-paid" aria-label="Recebimentos quitados">
              {visiblePaidOrders.map((order) => (
                <button type="button" className="receivable-ledger-row" aria-pressed={selectedEntryKey === `paid:${order.id}`} key={order.id} onClick={() => openPaidOrderDetail(order)}>
                  <span className="receivable-ledger-avatar receivable-ledger-avatar-paid"><Icon name="check" size={17} /></span>
                  <span className="receivable-ledger-main"><strong>{order.client || 'Pedido sem identificação'}</strong><span>{formatOrderDisplayNumber(order)} · {getOrderItemsSummary(order)}</span><span className="receivable-paid-meta">{paidMeta(order)}</span></span>
                  <strong className="receivable-ledger-amount">{currency(order.total || 0)}</strong><Icon name="details" size={18} />
                </button>
              ))}
              {!visiblePaidOrders.length && <div className="empty-state receivables-empty-state"><Icon name="check" size={28} /><strong>{allPaidOrders.length ? 'Nenhum recebimento neste filtro' : 'Nenhum recebimento registrado ainda'}</strong><span>{allPaidOrders.length ? 'Tente outro período ou ajuste a busca.' : 'Os pedidos pagos aparecerão aqui.'}</span></div>}
            </div>
          )}
        </section>

        <aside className="receivables-detail-panel" aria-label="Detalhes do recebimento">
          {detail || <div className="receivable-detail-empty">Selecione um recebimento para ver os detalhes.</div>}
        </aside>
      </div>

      {canReceivePayments && activeView === 'pending' && !overlayOpen && (
        <button
          type="button"
          className="receivables-payment-fab"
          aria-label="Registrar recebimento"
          onClick={() => setQuickPaymentOpen(true)}
          disabled={writeDisabled || quickPaymentEntries.length === 0 || !onRegisterPayment}
        >
          <Icon name="plus" size={20} />
          <span>Registrar recebimento</span>
        </button>
      )}

      <BottomSheet open={Boolean(selectedEntry) && mobileDetailOpen && isMobileDetail} title="Detalhes do recebimento" onClose={closeMobileDetail}>
        <ReceivableDetail
          entry={selectedEntry}
          currency={currency}
          disabled={writeDisabled}
          canReceivePayments={canReceivePayments}
          canManagePaymentPromises={canManagePaymentPromises}
          onRegisterPayment={registerPaymentFromDetail}
          onEditPaymentPromise={editPaymentPromiseFromDetail}
          onViewOrder={viewOrderFromDetail}
        />
      </BottomSheet>

      {forecastOpen && (
        <ReceivablesForecastDialog
          forecast={forecast}
          receivedToday={receivedToday}
          currency={currency}
          onClose={() => setForecastOpen(false)}
          onSelectDate={applyForecastDate}
        />
      )}

      {canReceivePayments && quickPaymentOpen && (
        <ReceivablesQuickPaymentDialog
          open={quickPaymentOpen}
          entries={quickPaymentEntries}
          currency={currency}
          disabled={writeDisabled}
          onClose={() => setQuickPaymentOpen(false)}
          onSelect={registerQuickPayment}
        />
      )}

      {canManagePaymentPromises && promiseOrder && <PaymentPromiseDialog order={promiseOrder} today={today} disabled={writeDisabled} onSave={(...args) => canManagePaymentPromises ? onUpdatePaymentPromise?.(...args) : false} onClose={() => setPromiseOrder(null)} />}
      {detailOrder && <OrderDetail order={detailOrder} currency={currency} canExecutePrinting={canExecutePrinting} onClose={() => setDetailOrder(null)} />}

    </>
  )
}

export default Receivables
