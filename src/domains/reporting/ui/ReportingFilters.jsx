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
  const supportsCustomer = ['overview', 'sales', 'products', 'operation'].includes(query.view)
  const advancedActive = [
    supportsCustomer && query.customer,
    query.view === 'sales' && query.paymentMethod,
    query.view === 'operation' && query.operationalDeadline,
    query.view === 'operation' && query.orderHourFrom != null,
    query.view === 'operation' && query.orderHourTo != null,
  ].filter(Boolean).length

  return <section className="reporting-filter-shell" aria-label="Filtros de relatórios">
    <div className="reporting-filter-primary">
      <div className="reporting-period-presets" role="group" aria-label="Período rápido">
        {PERIODS.map(([value, label]) => <button key={value} type="button" className={query.period === value ? 'active' : ''} aria-pressed={query.period === value} onClick={() => onChange({ period: value })}>{label}</button>)}
      </div>

      <div className="reporting-filter-row">
        <div className="reporting-date-range" aria-label="Intervalo selecionado">
          <label>De<input type="date" value={query.from} onChange={(event) => onChange({ from: event.target.value })} /></label>
          <span aria-hidden="true">→</span>
          <label>Até<input type="date" value={query.to} onChange={(event) => onChange({ to: event.target.value })} /></label>
        </div>

        <div className="reporting-filter-control"><span>Modalidade</span><SystemSelect value={query.type || ''} options={TYPE_OPTIONS} label="Modalidade" onChange={(type) => onChange({ type: type || null })} /></div>
        <div className="reporting-filter-control"><span>Agendamento</span><SystemSelect label="Agendamento" value={query.schedule || ''} options={SCHEDULE_OPTIONS} onChange={(value) => onChange({ schedule: value || null })} /></div>

        <details className={advancedActive ? 'reporting-more-filters has-active' : 'reporting-more-filters'}>
          <summary>Mais filtros{advancedActive ? <span className="reporting-filter-count">{advancedActive}</span> : null}</summary>
          <div className="reporting-more-filters-panel">
            {supportsCustomer ? <label>Cliente<input value={query.customer || ''} onChange={(event) => onChange({ customer: event.target.value || null })} placeholder="Todos os clientes" /></label> : null}
            {query.view === 'sales' ? <div className="reporting-filter-control"><span>Forma de pagamento</span><SystemSelect label="Forma de pagamento" value={query.paymentMethod || ''} options={PAYMENT_OPTIONS} onChange={(value) => onChange({ paymentMethod: value || null })} /></div> : null}
            {query.view === 'operation' ? <>
              <div className="reporting-filter-control"><span>Prazo</span><SystemSelect label="Prazo" value={query.operationalDeadline || ''} options={DEADLINE_OPTIONS} onChange={(value) => onChange({ operationalDeadline: value || null })} /></div>
              <label>Hora de<input type="number" min="0" max="23" value={query.orderHourFrom ?? ''} onChange={(event) => onChange({ orderHourFrom: event.target.value === '' ? null : Number(event.target.value) })} /></label>
              <label>Hora até<input type="number" min="0" max="23" value={query.orderHourTo ?? ''} onChange={(event) => onChange({ orderHourTo: event.target.value === '' ? null : Number(event.target.value) })} /></label>
            </> : null}
          </div>
        </details>
      </div>
    </div>
  </section>
}
