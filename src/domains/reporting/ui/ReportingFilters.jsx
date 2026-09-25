import SystemSelect from '../../../shared/ui/SystemSelect.jsx'

const TYPE_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'Entrega', label: 'Entrega' },
  { value: 'Retirada', label: 'Retirada' },
  { value: 'Local', label: 'Local' },
]
const PERIODS = [
  ['today', 'Hoje'], ['7-days', '7 dias'], ['30-days', '30 dias'],
  ['current-month', 'Mês atual'], ['previous-month', 'Mês anterior'], ['custom', 'Personalizado'],
]
const SCHEDULE_OPTIONS = [{ value: '', label: 'Todos' }, { value: 'immediate', label: 'Imediato' }, { value: 'scheduled', label: 'Agendado' }]
const PAYMENT_OPTIONS = [{ value: '', label: 'Todas' }, { value: 'pix', label: 'Pix' }, { value: 'cash', label: 'Dinheiro' }, { value: 'credit_card', label: 'Cartão de crédito' }, { value: 'debit_card', label: 'Cartão de débito' }, { value: 'transfer', label: 'Transferência' }, { value: 'other', label: 'Outros' }]
const DEADLINE_OPTIONS = [{ value: '', label: 'Todos' }, { value: 'on-time', label: 'No prazo' }, { value: 'late', label: 'Atrasados' }]

export function ReportingFilters({ query, onChange }) {
  return <section className="reporting-filter-shell" aria-label="Filtros de relatórios">
    <div className="reporting-period-presets" role="group" aria-label="Período rápido">{PERIODS.map(([value, label]) => <button key={value} type="button" className={query.period === value ? 'active' : ''} aria-pressed={query.period === value} onClick={() => onChange({ period: value })}>{label}</button>)}</div>
    <label>Período inicial<input type="date" value={query.from} onChange={(event) => onChange({ from: event.target.value })} /></label>
    <label>Período final<input type="date" value={query.to} onChange={(event) => onChange({ to: event.target.value })} /></label>
    <SystemSelect value={query.type || ''} options={TYPE_OPTIONS} label="Modalidade" onChange={(type) => onChange({ type: type || null })} />
    <div><span>Agendamento</span><SystemSelect label="Agendamento" value={query.schedule || ''} options={SCHEDULE_OPTIONS} onChange={(value) => onChange({ schedule: value || null })} /></div>
    {['overview', 'sales', 'products', 'operation'].includes(query.view) ? <>
      <label>Categoria<input value={query.category || ''} onChange={(event) => onChange({ category: event.target.value || null })} placeholder="Todas" /></label>
      <label>Produto<input value={query.product || ''} onChange={(event) => onChange({ product: event.target.value || null })} placeholder="Todos" /></label>
      <label>Cliente<input value={query.customer || ''} onChange={(event) => onChange({ customer: event.target.value || null })} placeholder="Todos" /></label>
    </> : null}
    {query.view === 'sales' ? <div><span>Forma de pagamento</span><SystemSelect label="Forma de pagamento" value={query.paymentMethod || ''} options={PAYMENT_OPTIONS} onChange={(value) => onChange({ paymentMethod: value || null })} /></div> : null}
    {query.view === 'operation' ? <div><span>Prazo</span><SystemSelect label="Prazo" value={query.operationalDeadline || ''} options={DEADLINE_OPTIONS} onChange={(value) => onChange({ operationalDeadline: value || null })} /></div> : null}
  </section>
}
