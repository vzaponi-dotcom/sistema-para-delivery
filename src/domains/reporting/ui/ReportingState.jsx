export function ReportingState({ state, children }) {
  if (state.loading && !state.data) return <section className="surface-card reporting-shell-state" aria-live="polite">Carregando métricas oficiais…</section>
  if (state.error && !state.data) return <section className="surface-card reporting-shell-state" role="alert">Não foi possível carregar este relatório.</section>
  if (!state.data) return <section className="surface-card reporting-shell-state">Nenhum dado no período selecionado.</section>
  return <>{state.loading ? <p className="reporting-refresh" role="status">Atualizando relatório…</p> : null}
    {state.error ? <p className="reporting-refresh-error" role="status">Não foi possível atualizar. Exibindo os últimos dados válidos.</p> : null}
    {children}</>
}
