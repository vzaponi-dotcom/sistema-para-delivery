import Icon from '../../../shared/ui/Icon.jsx'
import SystemSelect from '../../../shared/ui/SystemSelect.jsx'

const TYPE_OPTIONS = [
  { value: '', label: 'Todas as modalidades' },
  { value: 'Entrega', label: 'Entrega' },
  { value: 'Retirada', label: 'Retirada' },
  { value: 'Local', label: 'Local' },
]
const PERIODS = [
  ['today', 'Hoje'], ['7-days', '7 dias'], ['30-days', '30 dias'],
  ['current-month', 'Mês atual'], ['previous-month', 'Mês anterior'],
]
const SCHEDULE_OPTIONS = [{ value: '', label: 'Todos' }, { value: 'immediate', label: 'Imediato' }, { value: 'scheduled', label: 'Agendado' }]
const PAYMENT_OPTIONS = [{ value: '', label: 'Todas as formas' }, { value: 'pix', label: 'Pix' }, { value: 'cash', label: 'Dinheiro' }, { value: 'credit_card', label: 'Cartão de crédito' }, { value: 'debit_card', label: 'Cartão de débito' }, { value: 'transfer', label: 'Transferência' }, { value: 'other', label: 'Outros' }]
const DEADLINE_OPTIONS = [{ value: '', label: 'Todos' }, { value: 'on-time', label: 'No prazo' }, { value: 'late', label: 'Atrasados' }]

export function ReportingFilters({ query, onChange, exportAction = null }) {
  const supportsCustomer = query.view === 'operation'
  const usesPayment = ['sales', 'detail'].includes(query.view)
  const advancedActive = [
    supportsCustomer && query.customer,
    query.view === 'operation' && query.operationalDeadline,
    query.view === 'operation' && query.orderHourFrom != null,
    query.view === 'operation' && query.orderHourTo != null,
  ].filter(Boolean).length
  const hasAdvanced = query.view === 'operation'

  return <section className="reporting-filter-shell reporting-filter-toolbar-shell" aria-label="Filtros de relatórios">
    <div className="reporting-filter-toolbar">
      <div className="reporting-period-block">
        <span className="reporting-filter-toolbar-label">Período</span>
        <div className="reporting-period-toolbar">
          <div className="reporting-date-range-compact" aria-label="Intervalo selecionado">
            <Icon name="clock" size={16} />
            <input aria-label="Data inicial" type="date" value={query.from} onChange={(event) => onChange({ from: event.target.value })} />
            <span aria-hidden="true">–</span>
            <input aria-label="Data final" type="date" value={query.to} onChange={(event) => onChange({ to: event.target.value })} />
          </div>
          <div className="reporting-period-presets reporting-period-presets-inline" role="group" aria-label="Período rápido">
            {PERIODS.map(([value, label]) => <button key={value} type="button" className={query.period === value ? 'active' : ''} aria-pressed={query.period === value} onClick={() => onChange({ period: value })}>{label}</button>)}
          </div>
        </div>
      </div>

      <div className="reporting-filter-control reporting-filter-toolbar-control">
        <span>Modalidade</span>
        <SystemSelect value={query.type || ''} options={TYPE_OPTIONS} label="Modalidade" onChange={(type) => onChange({ type: type || null })} />
      </div>

      {usesPayment ? <div className="reporting-filter-control reporting-filter-toolbar-control">
        <span>Forma de pagamento</span>
        <SystemSelect label="Forma de pagamento" value={query.paymentMethod || ''} options={PAYMENT_OPTIONS} onChange={(value) => onChange({ paymentMethod: value || null })} />
      </div> : <div className="reporting-filter-control reporting-filter-toolbar-control">
        <span>Agendamento</span>
        <SystemSelect label="Agendamento" value={query.schedule || ''} options={SCHEDULE_OPTIONS} onChange={(value) => onChange({ schedule: value || null })} />
      </div>}

      {hasAdvanced ? <details className={advancedActive ? 'reporting-more-filters reporting-toolbar-more-filters has-active' : 'reporting-more-filters reporting-toolbar-more-filters'}>
        <summary><Icon name="settings" size={16} />Mais filtros{advancedActive ? <span className="reporting-filter-count">{advancedActive}</span> : null}</summary>
        <div className="reporting-more-filters-panel">
          {supportsCustomer ? <label>Cliente<input value={query.customer || ''} onChange={(event) => onChange({ customer: event.target.value || null })} placeholder="Todos os clientes" /></label> : null}
          {query.view === 'operation' ? <>
            <div className="reporting-filter-control"><span>Prazo</span><SystemSelect label="Prazo" value={query.operationalDeadline || ''} options={DEADLINE_OPTIONS} onChange={(value) => onChange({ operationalDeadline: value || null })} /></div>
            <label>Hora de<input type="number" min="0" max="23" value={query.orderHourFrom ?? ''} onChange={(event) => onChange({ orderHourFrom: event.target.value === '' ? null : Number(event.target.value) })} /></label>
            <label>Hora até<input type="number" min="0" max="23" value={query.orderHourTo ?? ''} onChange={(event) => onChange({ orderHourTo: event.target.value === '' ? null : Number(event.target.value) })} /></label>
          </> : null}
        </div>
      </details> : null}

      {exportAction ? <div className="reporting-filter-export">{exportAction}</div> : null}
    </div>
  </section>
}
