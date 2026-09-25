export function ReportingState({ state, children }) {
  if (state.loading && !state.data) return <section className="surface-card reporting-shell-state" aria-live="polite">Carregando métricas oficiais…</section>
  if (state.error && !state.data) return <section className="surface-card reporting-shell-state" role="alert">Não foi possível carregar este relatório.</section>
  if (!state.data) return <section className="surface-card reporting-shell-state">Nenhum dado no período selecionado.</section>
  return children
}
