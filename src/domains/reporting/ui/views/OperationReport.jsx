import { ReportingMetricCard } from '../ReportingMetricCard.jsx'
import { ReportingState } from '../ReportingState.jsx'

const distribution = (items = [], key, label) => <ul className="reporting-bars">{items.filter((item) => item.count > 0).map((item) => <li key={item[key]}><span>{label(item)}</span><meter min="0" max={Math.max(1, ...items.map((row) => row.count))} value={item.count}>{item.count}</meter><strong>{item.count}</strong></li>)}</ul>
const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function OperationReport({ state, onDrilldown = () => {} }) {
  const data = state.data
  const comparison = state.comparison?.metrics || {}
  return <ReportingState state={state}>{data ? <>
    <section className="reporting-metric-grid" aria-label="Indicadores operacionais">
      <ReportingMetricCard label="Pedidos operacionais" value={data.operationalOrdersCount} kind="number" comparison={comparison.operationalOrdersCount} />
      <ReportingMetricCard label="Tempo médio" value={data.averageDurationMinutes} kind="number" comparison={comparison.averageDurationMinutes} />
      <ReportingMetricCard label="Mediana" value={data.medianDurationMinutes} kind="number" comparison={comparison.medianDurationMinutes} />
      <ReportingMetricCard label="P90" value={data.p90DurationMinutes} kind="number" comparison={comparison.p90DurationMinutes} />
      <ReportingMetricCard label="Mais rápido" value={data.fastestMinutes} kind="number" />
      <ReportingMetricCard label="Mais lento" value={data.slowestMinutes} kind="number" />
      <ReportingMetricCard label="Dentro do prazo" value={data.withinDeadlineCount} kind="number" onDrilldown={() => onDrilldown({ view: 'detail', operationalDeadline: 'on-time' })} />
      <ReportingMetricCard label="Fora do prazo" value={data.outsideDeadlineCount} kind="number" onDrilldown={() => onDrilldown({ view: 'detail', operationalDeadline: 'late' })} />
      <ReportingMetricCard label="Dentro do prazo" value={data.withinDeadlineRate} kind="percent" comparison={comparison.withinDeadlineRate} />
      <ReportingMetricCard label="Atraso médio" value={data.averageLateMinutes} kind="number" />
      <ReportingMetricCard label="Pontualidade agendada" value={data.scheduledPunctualityRate} kind="percent" />
    </section>
    {state.quality?.invalidCount ? <p role="status">Cobertura parcial dos dados operacionais.</p> : null}
    {state.warnings?.map((warning) => <p role="status" key={warning}>{warning}</p>)}
    <div className="reporting-panel-grid">
      <section className="surface-card reporting-panel"><h2>Pedidos por hora operacional</h2>{distribution(data.byHour, 'hour', (item) => `${String(item.hour).padStart(2, '0')}h`)}</section>
      <section className="surface-card reporting-panel"><h2>Pedidos por dia da semana</h2>{distribution(data.byWeekday, 'weekday', (item) => weekdays[item.weekday])}</section>
      <section className="surface-card reporting-panel"><h2>Volume por modalidade</h2>{distribution(data.byModality, 'type', (item) => item.type)}</section>
    </div>
    <div className="reporting-panel-grid">
      <section className="surface-card reporting-panel"><h2>Imediatos x agendados</h2>{distribution(data.bySchedule, 'schedule', (item) => item.schedule === 'scheduled' ? 'Agendados' : 'Imediatos')}</section>
      <section className="surface-card reporting-panel"><h2>Faixas de duração</h2>{distribution(data.durationBands, 'label', (item) => item.label)}</section>
      <section className="surface-card reporting-panel"><h2>Tempo por modalidade</h2><ul>{data.byModality?.map((item) => <li key={item.type}>{item.type}: {item.averageDurationMinutes == null ? 'Indisponível' : `${item.averageDurationMinutes} min`}</li>)}</ul></section>
    </div>
  </> : null}</ReportingState>
}
