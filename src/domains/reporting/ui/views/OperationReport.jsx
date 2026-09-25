import { ReportingMetricCard } from '../ReportingMetricCard.jsx'
import { ReportingState } from '../ReportingState.jsx'

export function OperationReport({ state }) {
  const data = state.data
  return <ReportingState state={state}>{data ? <>
    <section className="reporting-metric-grid" aria-label="Indicadores operacionais">
      <ReportingMetricCard label="Tempo médio" value={data.averageDurationMinutes} kind="number" />
      <ReportingMetricCard label="Mediana" value={data.medianDurationMinutes} kind="number" />
      <ReportingMetricCard label="P90" value={data.p90DurationMinutes} kind="number" />
      <ReportingMetricCard label="Dentro do prazo" value={data.withinDeadlineRate} kind="percent" />
    </section>
    {state.quality?.invalidCount ? <p role="status">Cobertura parcial dos dados operacionais.</p> : null}
    <section className="surface-card"><h2>Resumo operacional</h2><p>Tempo por hora, dia e modalidade é calculado no servidor.</p></section>
  </> : null}</ReportingState>
}
