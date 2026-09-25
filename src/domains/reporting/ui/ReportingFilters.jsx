import SystemSelect from '../../../shared/ui/SystemSelect.jsx'

const TYPE_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'Entrega', label: 'Entrega' },
  { value: 'Retirada', label: 'Retirada' },
  { value: 'Local', label: 'Local' },
]

export function ReportingFilters({ query, onChange }) {
  return <section className="reporting-filter-shell" aria-label="Filtros de relatórios">
    <label>Período inicial<input type="date" value={query.from} onChange={(event) => onChange({ from: event.target.value })} /></label>
    <label>Período final<input type="date" value={query.to} onChange={(event) => onChange({ to: event.target.value })} /></label>
    <SystemSelect value={query.type || ''} options={TYPE_OPTIONS} label="Modalidade" onChange={(type) => onChange({ type: type || null })} />
  </section>
}
