import { useState } from 'react'
import { ReportingState } from '../ReportingState.jsx'
import { ReportingOrderDrawer } from '../detail/ReportingOrderDrawer.jsx'
import SystemSelect from '../../../../shared/ui/SystemSelect.jsx'

const money = (cents) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
const FILTERS = ['type', 'schedule', 'status', 'paymentMethod', 'category', 'product', 'productName', 'customer', 'orderHourFrom', 'orderHourTo', 'operationalDeadline', 'receivable', 'search']
const COLUMNS = [
  ['order_number', 'Pedido'], ['order_date', 'Data'], ['client_name_snapshot', 'Cliente'],
  ['type', 'Modalidade'], ['status', 'Status'], ['total_cents', 'Total'],
  ['paidCents', 'Recebido'], ['pendingCents', 'Pendente'], ['durationMinutes', 'Duração'], ['onTime', 'Prazo'],
]
export const DEFAULT_DETAIL_COLUMNS = COLUMNS.map(([key]) => key)
const STATUS_OPTIONS = [{ value: '', label: 'Todos' }, ...['Em preparo', 'Finalizado', 'Entregue', 'Despachado', 'Cancelado'].map((value) => ({ value, label: value }))]
const SCHEDULE_OPTIONS = [{ value: '', label: 'Todos' }, { value: 'immediate', label: 'Imediato' }, { value: 'scheduled', label: 'Agendado' }]
const DEADLINE_OPTIONS = [{ value: '', label: 'Todos' }, { value: 'on-time', label: 'No prazo' }, { value: 'late', label: 'Atrasado' }]
const RECEIVABLE_OPTIONS = [{ value: '', label: 'Todos' }, { value: 'unpaid', label: 'A receber' }]
const SORT_OPTIONS = [{ value: 'date-desc', label: 'Mais recentes' }, { value: 'date-asc', label: 'Mais antigos' }, { value: 'total-desc', label: 'Maior total' }, { value: 'total-asc', label: 'Menor total' }, { value: 'duration-desc', label: 'Maior duração' }, { value: 'duration-asc', label: 'Menor duração' }]
const SIZE_OPTIONS = [25, 50, 100].map((value) => ({ value, label: String(value) }))
const valueOf = (item, key) => {
  if (key === 'total_cents' || key === 'paidCents' || key === 'pendingCents') return money(item[key])
  if (key === 'durationMinutes') return item.durationMinutes == null ? 'Indisponível' : `${item.durationMinutes} min`
  if (key === 'onTime') return item.onTime == null ? 'Indisponível' : item.onTime ? 'No prazo' : 'Atrasado'
  return item[key] ?? '—'
}

export function DetailReport({ state, query, onChange, orderApi, selectedColumns, onColumnsChange }) {
  const [selected, setSelected] = useState(null)
  const [localColumns, setLocalColumns] = useState(DEFAULT_DETAIL_COLUMNS)
  const columns = selectedColumns || localColumns
  const setColumns = onColumnsChange || setLocalColumns
  const data = state.data
  const active = FILTERS.filter((key) => query[key] !== null && query[key] !== undefined && query[key] !== '')
  return <div className="reporting-detail-layout">
    <section className="surface-card reporting-panel">
      <div className="reporting-section-heading"><div><h2>Pedidos ({data?.total ?? 0})</h2><p>Pedidos do recorte selecionado. Página calculada no servidor.</p></div>
        <details className="reporting-columns"><summary>Colunas</summary>{COLUMNS.map(([key, label]) => <label key={key}><input type="checkbox" checked={columns.includes(key)} onChange={(event) => setColumns((current) => event.target.checked ? [...current, key] : current.filter((column) => column !== key))} />{label}</label>)}</details>
      </div>
      <div className="reporting-detail-filters">
        <label>Buscar<input aria-label="Buscar pedidos" value={query.search || ''} onChange={(event) => onChange({ search: event.target.value })} placeholder="Pedido, cliente ou telefone" /></label>
        <div><span>Status</span><SystemSelect label="Status" value={query.status || ''} options={STATUS_OPTIONS} onChange={(value) => onChange({ status: value || null })} /></div>
        <div><span>Agendamento</span><SystemSelect label="Agendamento" value={query.schedule || ''} options={SCHEDULE_OPTIONS} onChange={(value) => onChange({ schedule: value || null })} /></div>
        <label>Forma de pagamento<input value={query.paymentMethod || ''} onChange={(event) => onChange({ paymentMethod: event.target.value || null })} /></label>
        <label>Categoria<input value={query.category || ''} onChange={(event) => onChange({ category: event.target.value || null })} /></label>
        <label>Produto por nome<input value={query.productName || ''} onChange={(event) => onChange({ productName: event.target.value || null, product: null })} placeholder="Nome histórico" /></label>
        <label>Cliente<input value={query.customer || ''} onChange={(event) => onChange({ customer: event.target.value || null })} /></label>
        <div><span>Prazo</span><SystemSelect label="Prazo" value={query.operationalDeadline || ''} options={DEADLINE_OPTIONS} onChange={(value) => onChange({ operationalDeadline: value || null })} /></div>
        <div><span>Recebível</span><SystemSelect label="Recebível" value={query.receivable || ''} options={RECEIVABLE_OPTIONS} onChange={(value) => onChange({ receivable: value || null })} /></div>
        <label>Hora de<input type="number" min="0" max="23" value={query.orderHourFrom ?? ''} onChange={(event) => onChange({ orderHourFrom: event.target.value === '' ? null : Number(event.target.value) })} /></label>
        <label>Hora até<input type="number" min="0" max="23" value={query.orderHourTo ?? ''} onChange={(event) => onChange({ orderHourTo: event.target.value === '' ? null : Number(event.target.value) })} /></label>
      </div>
      {active.length ? <div className="reporting-filter-chips" aria-label="Filtros ativos">{active.map((key) => <button key={key} type="button" onClick={() => onChange({ [key]: null })}>{key}: {query[key]} ×</button>)}<button type="button" onClick={() => onChange(Object.fromEntries(FILTERS.map((key) => [key, null])))}>Limpar filtros</button></div> : null}
      <div className="reporting-detail-toolbar"><div><span>Ordenar</span><SystemSelect label="Ordenar" value={query.sort || 'date-desc'} options={SORT_OPTIONS} onChange={(value) => onChange({ sort: value })} /></div><div><span>Itens por página</span><SystemSelect label="Itens por página" value={query.pageSize} options={SIZE_OPTIONS} onChange={(value) => onChange({ pageSize: value, page: 1 })} /></div></div>
      <ReportingState state={state}>{data?.items?.length ? <div className="reporting-table-scroll"><table><thead><tr>{COLUMNS.filter(([key]) => columns.includes(key)).map(([key, label]) => <th key={key}>{label}</th>)}<th>Detalhes</th></tr></thead><tbody>{data.items.map((item) => <tr key={item.id}>{COLUMNS.filter(([key]) => columns.includes(key)).map(([key]) => <td key={key}>{valueOf(item, key)}</td>)}<td><button type="button" onClick={() => setSelected(item.id)} aria-label={`Ver pedido ${item.order_number}`}>Ver pedido</button></td></tr>)}</tbody></table></div> : <p>Nenhum pedido encontrado.</p>}</ReportingState>
      {data ? <nav className="reporting-pagination" aria-label="Páginas do relatório"><span>Mostrando página {data.page} de {data.totalPages || 1}</span><button type="button" disabled={data.page <= 1} onClick={() => onChange({ page: data.page - 1 })}>Anterior</button><button type="button" disabled={data.page >= data.totalPages} onClick={() => onChange({ page: data.page + 1 })}>Próxima</button></nav> : null}
    </section>
    {selected ? <ReportingOrderDrawer id={selected} onClose={() => setSelected(null)} api={orderApi} /> : null}
  </div>
}
