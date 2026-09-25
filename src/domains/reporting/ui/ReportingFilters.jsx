export function ReportingFilters({ query, onChange }) {
  return <section className="reporting-filter-shell" aria-label="Filtros de relatórios">
    <label>Período inicial<input type="date" value={query.from} onChange={(event) => onChange({ from: event.target.value })} /></label>
    <label>Período final<input type="date" value={query.to} onChange={(event) => onChange({ to: event.target.value })} /></label>
    <label>Modalidade<select value={query.type || ''} onChange={(event) => onChange({ type: event.target.value || null })}><option value="">Todas</option><option>Entrega</option><option>Retirada</option><option>Local</option></select></label>
  </section>
}
