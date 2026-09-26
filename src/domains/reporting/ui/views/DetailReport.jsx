import { useState } from 'react'
import Icon from '../../../../shared/ui/Icon.jsx'
import SystemSelect from '../../../../shared/ui/SystemSelect.jsx'
import { ReportingMetricCard } from '../ReportingMetricCard.jsx'
import { ReportingState } from '../ReportingState.jsx'
import { ReportingOrderDrawer } from '../detail/ReportingOrderDrawer.jsx'

const money = (cents) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cents || 0) / 100)
const number = (value) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(Number(value || 0))
const FILTERS = ['type', 'schedule', 'status', 'paymentMethod', 'category', 'product', 'productName', 'customer', 'orderHourFrom', 'orderHourTo', 'operationalDeadline', 'receivable', 'search']
const FILTER_LABELS = {
  type: 'Modalidade',
  schedule: 'Agendamento',
  status: 'Status',
  paymentMethod: 'Pagamento',
  category: 'Categoria',
  product: 'Produto',
  productName: 'Produto',
  customer: 'Cliente',
  orderHourFrom: 'Hora de',
  orderHourTo: 'Hora até',
  operationalDeadline: 'Prazo',
  receivable: 'Recebível',
  search: 'Busca',
}
const COLUMNS = [
  ['order_number', 'Pedido'], ['order_date', 'Data'], ['client_name_snapshot', 'Cliente'],
  ['type', 'Modalidade'], ['status', 'Status'], ['total_cents', 'Total'],
  ['paidCents', 'Recebido'], ['pendingCents', 'Pendente'], ['payment_label', 'Pagamento'],
  ['durationMinutes', 'Duração'], ['onTime', 'Prazo'],
]
export const DEFAULT_DETAIL_COLUMNS = COLUMNS.map(([key]) => key)
const STATUS_OPTIONS = [{ value: '', label: 'Todos' }, ...['Em preparo', 'Finalizado', 'Entregue', 'Despachado', 'Cancelado'].map((value) => ({ value, label: value }))]
const TYPE_OPTIONS = [{ value: '', label: 'Todas' }, ...['Entrega', 'Retirada', 'Local'].map((value) => ({ value, label: value }))]
const SCHEDULE_OPTIONS = [{ value: '', label: 'Todos' }, { value: 'immediate', label: 'Imediato' }, { value: 'scheduled', label: 'Agendado' }]
const DEADLINE_OPTIONS = [{ value: '', label: 'Todos' }, { value: 'on-time', label: 'No prazo' }, { value: 'late', label: 'Atrasado' }]
const RECEIVABLE_OPTIONS = [{ value: '', label: 'Todos' }, { value: 'unpaid', label: 'A receber' }]
const SORT_OPTIONS = [{ value: 'date-desc', label: 'Mais recentes' }, { value: 'date-asc', label: 'Mais antigos' }, { value: 'total-desc', label: 'Maior total' }, { value: 'total-asc', label: 'Menor total' }, { value: 'duration-desc', label: 'Maior duração' }, { value: 'duration-asc', label: 'Menor duração' }]
const SIZE_OPTIONS = [10, 25, 50, 100].map((value) => ({ value, label: String(value) }))

const statusClass = (status = '') => status === 'Cancelado'
  ? 'is-danger'
  : status === 'Em preparo'
    ? 'is-info'
    : status === 'Finalizado'
      ? 'is-neutral'
      : 'is-success'

const typeIcon = (type) => type === 'Retirada' ? 'pickup' : type === 'Local' ? 'table' : 'delivery'
const deadlineClass = (onTime) => onTime == null ? 'is-neutral' : onTime ? 'is-success' : 'is-danger'

const formatDateTime = (item) => {
  if (!item?.created_at) return item?.order_date || '—'
  const parsed = new Date(item.created_at)
  if (Number.isNaN(parsed.getTime())) return item.order_date || '—'
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(parsed).replace(',', '')
}

const filterValue = (key, value) => {
  if (key === 'product') return 'Selecionado'
  if (key === 'schedule') return value === 'scheduled' ? 'Agendado' : 'Imediato'
  if (key === 'operationalDeadline') return value === 'late' ? 'Atrasado' : 'No prazo'
  if (key === 'receivable') return 'A receber'
  return String(value)
}

const pageTokens = (page, totalPages) => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1)
  const tokens = new Set([1, totalPages, page - 1, page, page + 1].filter((value) => value >= 1 && value <= totalPages))
  const sorted = [...tokens].sort((a, b) => a - b)
  const output = []
  sorted.forEach((value, index) => {
    if (index && value - sorted[index - 1] > 1) output.push(`ellipsis-${value}`)
    output.push(value)
  })
  return output
}

const screenColumns = (columns) => {
  const selected = new Set(columns)
  const output = []
  for (const [key, label] of COLUMNS) {
    if (!selected.has(key)) continue
    if (key === 'pendingCents' && selected.has('paidCents')) continue
    if (key === 'paidCents' && selected.has('pendingCents')) output.push(['receivedPending', 'Recebido/Pendente'])
    else output.push([key, label])
  }
  return output
}

function DetailCell({ item, column }) {
  const [key] = column
  if (key === 'order_number') return <strong className="reporting-detail-order-number">#{item.order_number}</strong>
  if (key === 'order_date') return <span className="reporting-detail-date">{formatDateTime(item)}</span>
  if (key === 'client_name_snapshot') return <span className="reporting-detail-client"><strong>{item.client_name_snapshot || 'Sem cliente'}</strong>{item.client_phone_snapshot ? <small>{item.client_phone_snapshot}</small> : null}</span>
  if (key === 'type') return <span className="reporting-detail-type"><Icon name={typeIcon(item.type)} size={15} />{item.type || '—'}</span>
  if (key === 'status') return <span className={`reporting-detail-status ${statusClass(item.status)}`}>{item.status || '—'}</span>
  if (key === 'total_cents') return <strong className="reporting-detail-money">{money(item.total_cents)}</strong>
  if (key === 'paidCents') return <span className="reporting-detail-money">{money(item.paidCents)}</span>
  if (key === 'pendingCents') return <span className="reporting-detail-money">{money(item.pendingCents)}</span>
  if (key === 'receivedPending') {
    const paid = Number(item.paidCents || 0)
    const pending = Number(item.pendingCents || 0)
    return <span className={`reporting-detail-balance ${pending > 0 ? 'has-pending' : ''}`}>
      <strong>{money(paid > 0 ? paid : pending)}</strong>
      {paid > 0 && pending > 0 ? <small>{money(pending)} pendente</small> : null}
    </span>
  }
  if (key === 'payment_label') return <span className="reporting-detail-payment">{item.payment_label ? String(item.payment_label).split(',').join(' + ') : '—'}</span>
  if (key === 'durationMinutes') return <span>{item.durationMinutes == null ? '—' : `${number(item.durationMinutes)} min`}</span>
  if (key === 'onTime') return <span className={`reporting-detail-deadline ${deadlineClass(item.onTime)}`}>{item.onTime == null ? '—' : item.onTime ? 'No prazo' : 'Atrasado'}</span>
  return <span>{item[key] ?? '—'}</span>
}

export function DetailReport({ state, query, onChange, orderApi, selectedColumns, onColumnsChange }) {
  const [selected, setSelected] = useState(null)
  const [localColumns, setLocalColumns] = useState(DEFAULT_DETAIL_COLUMNS)
  const columns = selectedColumns || localColumns
  const setColumns = onColumnsChange || setLocalColumns
  const data = state.data
  const items = data?.items || []
  const commercialPage = items.filter((item) => item.status !== 'Cancelado')
  const fallbackSales = commercialPage.reduce((total, item) => total + Number(item.total_cents || 0), 0)
  const summary = data?.summary || {
    ordersCount: data?.total || 0,
    salesCents: fallbackSales,
    averageTicketCents: commercialPage.length ? Math.round(fallbackSales / commercialPage.length) : null,
    cancellationRate: items.length ? Number(((items.length - commercialPage.length) * 100 / items.length).toFixed(2)) : null,
  }
  const active = FILTERS.filter((key) => query[key] !== null && query[key] !== undefined && query[key] !== '')
  const advancedKeys = ['schedule', 'customer', 'operationalDeadline', 'receivable', 'orderHourFrom', 'orderHourTo']
  const advancedCount = advancedKeys.filter((key) => query[key] !== null && query[key] !== undefined && query[key] !== '').length
  const visibleColumns = screenColumns(columns)
  const pages = pageTokens(data?.page || 1, data?.totalPages || 1)
  const pageStart = data?.total ? ((data.page - 1) * data.pageSize) + 1 : 0
  const pageEnd = data?.total ? Math.min(data.total, data.page * data.pageSize) : 0
  const applyFilter = (patch) => onChange({ ...patch, page: 1 })

  return <div className="reporting-detail-layout reporting-detail-view">
    <section className="reporting-metric-grid reporting-detail-metrics" aria-label="Resumo dos pedidos">
      <ReportingMetricCard label="Pedidos no período" value={summary.ordersCount} kind="number" comparison={state.comparison?.metrics?.ordersCount} />
      <ReportingMetricCard label="Faturamento total" value={summary.salesCents} comparison={state.comparison?.metrics?.salesCents} />
      <ReportingMetricCard label="Ticket médio" value={summary.averageTicketCents} comparison={state.comparison?.metrics?.averageTicketCents} />
      <ReportingMetricCard label="Taxa de cancelamento" value={summary.cancellationRate} kind="percent" comparison={state.comparison?.metrics?.cancellationRate} />
    </section>

    <section className="surface-card reporting-panel reporting-detail-panel">
      <div className="reporting-detail-header">
        <div>
          <h2>Pedidos ({data?.total ?? 0})</h2>
          <p>Detalhamento dos pedidos no período selecionado.</p>
        </div>
        <div className="reporting-detail-header-actions">
          <details className="reporting-columns">
            <summary><Icon name="menu" size={16} />Colunas</summary>
            <div className="reporting-columns-menu">{COLUMNS.map(([key, label]) => <label key={key}><input type="checkbox" checked={columns.includes(key)} onChange={(event) => setColumns((currentColumns) => event.target.checked ? [...currentColumns, key] : currentColumns.filter((column) => column !== key))} />{label}</label>)}</div>
          </details>
          <div className="reporting-detail-sort"><span>Ordenar por</span><SystemSelect label="Ordenar" value={query.sort || 'date-desc'} options={SORT_OPTIONS} onChange={(value) => onChange({ sort: value, page: 1 })} /></div>
        </div>
      </div>

      <div className="reporting-detail-primary-filters">
        <label className="reporting-detail-search"><span>Buscar</span><span className="reporting-detail-input-shell"><Icon name="search" size={16} /><input aria-label="Buscar pedidos" value={query.search || ''} onChange={(event) => applyFilter({ search: event.target.value || null })} placeholder="Buscar por pedido, cliente ou telefone..." /></span></label>
        <div><span>Status</span><SystemSelect label="Status" value={query.status || ''} options={STATUS_OPTIONS} onChange={(value) => applyFilter({ status: value || null })} /></div>
        <div><span>Modalidade</span><SystemSelect label="Modalidade" value={query.type || ''} options={TYPE_OPTIONS} onChange={(value) => applyFilter({ type: value || null })} /></div>
        <label><span>Pagamento</span><input value={query.paymentMethod || ''} onChange={(event) => applyFilter({ paymentMethod: event.target.value || null })} placeholder="Todos" /></label>
        <details className={`reporting-detail-more-filters ${advancedCount ? 'has-active' : ''}`}>
          <summary><Icon name="settings" size={16} />Mais filtros{advancedCount ? <span>{advancedCount}</span> : null}</summary>
          <div className="reporting-detail-more-panel">
            <div><span>Agendamento</span><SystemSelect label="Agendamento" value={query.schedule || ''} options={SCHEDULE_OPTIONS} onChange={(value) => applyFilter({ schedule: value || null })} /></div>
            <label><span>Cliente</span><input value={query.customer || ''} onChange={(event) => applyFilter({ customer: event.target.value || null })} placeholder="Nome ou ID" /></label>
            <div><span>Prazo</span><SystemSelect label="Prazo" value={query.operationalDeadline || ''} options={DEADLINE_OPTIONS} onChange={(value) => applyFilter({ operationalDeadline: value || null })} /></div>
            <div><span>Recebível</span><SystemSelect label="Recebível" value={query.receivable || ''} options={RECEIVABLE_OPTIONS} onChange={(value) => applyFilter({ receivable: value || null })} /></div>
            <label><span>Hora de</span><input type="number" min="0" max="23" value={query.orderHourFrom ?? ''} onChange={(event) => applyFilter({ orderHourFrom: event.target.value === '' ? null : Number(event.target.value) })} /></label>
            <label><span>Hora até</span><input type="number" min="0" max="23" value={query.orderHourTo ?? ''} onChange={(event) => applyFilter({ orderHourTo: event.target.value === '' ? null : Number(event.target.value) })} /></label>
          </div>
        </details>
      </div>

      {active.length ? <div className="reporting-filter-chips reporting-detail-filter-chips" aria-label="Filtros ativos">
        {active.map((key) => <button key={key} type="button" onClick={() => applyFilter({ [key]: null })}>{FILTER_LABELS[key]}: {filterValue(key, query[key])} ×</button>)}
        <button className="reporting-detail-clear-filters" type="button" onClick={() => onChange({ ...Object.fromEntries(FILTERS.map((key) => [key, null])), page: 1 })}>Limpar filtros</button>
      </div> : null}

      <ReportingState state={state}>{items.length ? <div className="reporting-detail-table-wrap">
        <table className="reporting-detail-table">
          <thead><tr>{visibleColumns.map(([key, label]) => <th key={key}>{label}</th>)}<th className="reporting-detail-actions-column" aria-label="Ações">•••</th></tr></thead>
          <tbody>{items.map((item) => <tr key={item.id} className={selected === item.id ? 'is-selected' : ''}>
            {visibleColumns.map((column) => <td key={column[0]}><DetailCell item={item} column={column} /></td>)}
            <td className="reporting-detail-actions-column"><button className="reporting-detail-row-action" type="button" onClick={() => setSelected(item.id)} aria-label={`Ver pedido ${item.order_number}`}>•••</button></td>
          </tr>)}</tbody>
        </table>
      </div> : <div className="reporting-products-empty">Nenhum pedido encontrado.</div>}</ReportingState>

      {data ? <nav className="reporting-detail-pagination" aria-label="Páginas do relatório">
        <span>Mostrando {pageStart}–{pageEnd} de {data.total} pedidos</span>
        <div className="reporting-detail-page-buttons">
          <button type="button" aria-label="Página anterior" disabled={data.page <= 1} onClick={() => onChange({ page: data.page - 1 })}>‹</button>
          {pages.map((token) => typeof token === 'string'
            ? <span key={token} className="reporting-detail-page-ellipsis">…</span>
            : <button key={token} type="button" className={token === data.page ? 'is-active' : ''} aria-current={token === data.page ? 'page' : undefined} onClick={() => onChange({ page: token })}>{token}</button>)}
          <button type="button" aria-label="Próxima página" disabled={data.page >= data.totalPages} onClick={() => onChange({ page: data.page + 1 })}>›</button>
        </div>
        <div className="reporting-detail-page-size"><span>Itens por página</span><SystemSelect label="Itens por página" value={query.pageSize} options={SIZE_OPTIONS} onChange={(value) => onChange({ pageSize: value, page: 1 })} /></div>
      </nav> : null}
    </section>

    {selected ? <ReportingOrderDrawer id={selected} onClose={() => setSelected(null)} api={orderApi} /> : null}
  </div>
}
