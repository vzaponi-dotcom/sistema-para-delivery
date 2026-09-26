import { ReportingMetricCard } from '../ReportingMetricCard.jsx'
import { ReportingState } from '../ReportingState.jsx'
import Icon from '../../../../shared/ui/Icon.jsx'

const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
const safeCount = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function HorizontalDistribution({ items = [], keyField, labelOf, valueField = 'count' }) {
  const normalized = items.filter(Boolean).map((item) => ({ ...item, value: safeCount(item[valueField]) }))
  const max = Math.max(1, ...normalized.map((item) => item.value))
  if (!normalized.length) return <div className="reporting-operation-empty">Sem dados operacionais neste recorte.</div>

  return <div className="reporting-operation-bars">
    {normalized.map((item) => <div className="reporting-operation-bar-row" key={item[keyField]}>
      <div className="reporting-operation-bar-copy"><span>{labelOf(item)}</span><strong>{item.value}</strong></div>
      <div className="reporting-operation-bar-track" aria-hidden="true"><span style={{ width: `${item.value * 100 / max}%` }} /></div>
    </div>)}
  </div>
}

function HourChart({ items = [] }) {
  const byHour = new Map(items.map((item) => [Number(item.hour), safeCount(item.count)]))
  const slots = Array.from({ length: 24 }, (_, hour) => ({ hour, count: byHour.get(hour) || 0 }))
  const max = Math.max(1, ...slots.map((slot) => slot.count))
  const total = slots.reduce((sum, slot) => sum + slot.count, 0)
  if (!total) return <div className="reporting-operation-empty">Nenhum pedido com hora operacional disponível.</div>

  return <div className="reporting-hour-chart" role="img" aria-label="Distribuição de pedidos por hora operacional">
    <div className="reporting-hour-columns">
      {slots.map((slot) => <div className="reporting-hour-slot" key={slot.hour} title={`${String(slot.hour).padStart(2, '0')}h · ${slot.count} pedido(s)`}>
        <span className="reporting-hour-bar" style={{ height: `${Math.max(slot.count ? 8 : 2, slot.count * 100 / max)}%` }} />
        <small>{[0, 6, 12, 18, 23].includes(slot.hour) ? `${String(slot.hour).padStart(2, '0')}h` : ''}</small>
      </div>)}
    </div>
  </div>
}

function ScheduleSplit({ items = [] }) {
  const immediate = safeCount(items.find((item) => item.schedule !== 'scheduled')?.count)
  const scheduled = safeCount(items.find((item) => item.schedule === 'scheduled')?.count)
  const total = immediate + scheduled
  const immediateShare = total ? immediate * 100 / total : 0
  const scheduledShare = total ? scheduled * 100 / total : 0

  return <div className="reporting-operation-split">
    <div className="reporting-operation-split-track" aria-label={total ? `${number.format(immediateShare)}% imediatos e ${number.format(scheduledShare)}% agendados` : 'Sem pedidos'}>
      <span className="is-immediate" style={{ width: `${immediateShare}%` }} />
      <span className="is-scheduled" style={{ width: `${scheduledShare}%` }} />
    </div>
    <div className="reporting-operation-split-legend">
      <div><span className="reporting-legend-dot is-received" /><span>Imediatos</span><strong>{immediate}</strong><small>{number.format(immediateShare)}%</small></div>
      <div><span className="reporting-legend-dot is-pending" /><span>Agendados</span><strong>{scheduled}</strong><small>{number.format(scheduledShare)}%</small></div>
    </div>
  </div>
}

function ModalityPerformance({ items = [] }) {
  const rows = items.filter((item) => item?.type)
  const maxCount = Math.max(1, ...rows.map((item) => safeCount(item.count)))
  if (!rows.length) return <div className="reporting-operation-empty">Sem modalidades no período.</div>

  return <div className="reporting-modality-performance">
    {rows.map((item) => <div className="reporting-modality-row" key={item.type}>
      <div className="reporting-modality-copy">
        <strong>{item.type}</strong>
        <span>{safeCount(item.count)} pedido(s)</span>
      </div>
      <div className="reporting-modality-track" aria-hidden="true"><span style={{ width: `${safeCount(item.count) * 100 / maxCount}%` }} /></div>
      <div className="reporting-modality-time">
        <span>Tempo médio</span>
        <strong>{item.averageDurationMinutes == null ? 'Indisponível' : `${number.format(item.averageDurationMinutes)} min`}</strong>
      </div>
    </div>)}
  </div>
}

export function OperationReport({ state, onDrilldown = () => {} }) {
  const data = state.data
  const comparison = state.comparison?.metrics || {}

  return <ReportingState state={state}>{data ? <div className="reporting-view-stack reporting-operation-view">
    <div className="reporting-view-heading">
      <div><span className="section-kicker">Operação</span><h2>Performance operacional</h2><p>Entenda velocidade, prazo e distribuição da operação com os principais indicadores do período.</p></div>
    </div>

    <section className="reporting-metric-grid reporting-operation-primary-metrics" aria-label="Indicadores operacionais principais">
      <ReportingMetricCard label="Pedidos operacionais" value={data.operationalOrdersCount} kind="number" comparison={comparison.operationalOrdersCount} />
      <ReportingMetricCard label="Tempo médio" value={data.averageDurationMinutes} kind="minutes" comparison={comparison.averageDurationMinutes} />
      <ReportingMetricCard label="P90" value={data.p90DurationMinutes} kind="minutes" comparison={comparison.p90DurationMinutes} />
      <ReportingMetricCard label="Taxa no prazo" value={data.withinDeadlineRate} kind="percent" comparison={comparison.withinDeadlineRate} />
    </section>

    <section className="reporting-metric-grid reporting-operation-secondary-metrics" aria-label="Indicadores operacionais complementares">
      <ReportingMetricCard label="Mediana" value={data.medianDurationMinutes} kind="minutes" comparison={comparison.medianDurationMinutes} />
      <ReportingMetricCard label="Mais rápido" value={data.fastestMinutes} kind="minutes" />
      <ReportingMetricCard label="Mais lento" value={data.slowestMinutes} kind="minutes" />
      <ReportingMetricCard label="Pedidos no prazo" value={data.withinDeadlineCount} kind="number" onDrilldown={() => onDrilldown({ view: 'detail', operationalDeadline: 'on-time' })} />
      <ReportingMetricCard label="Pedidos fora do prazo" value={data.outsideDeadlineCount} kind="number" onDrilldown={() => onDrilldown({ view: 'detail', operationalDeadline: 'late' })} />
      <ReportingMetricCard label="Atraso médio" value={data.averageLateMinutes} kind="minutes" />
      <ReportingMetricCard label="Pontualidade agendada" value={data.scheduledPunctualityRate} kind="percent" />
    </section>

    {state.quality?.invalidCount ? <aside className="reporting-operation-note" role="status"><Icon name="alert" size={17} /><div><strong>Cobertura parcial</strong><span>Alguns pedidos não possuem dados suficientes para compor todas as métricas operacionais.</span></div></aside> : null}
    {state.warnings?.filter(Boolean).map((warning) => <p className="reporting-warning" role="status" key={warning}>{warning}</p>)}

    <div className="reporting-operation-grid">
      <section className="surface-card reporting-panel reporting-operation-panel reporting-operation-hour-panel">
        <div className="reporting-panel-heading"><div><span className="section-kicker">Demanda</span><h2>Pedidos por hora operacional</h2></div><span className="reporting-panel-badge">24 horas</span></div>
        <HourChart items={data.byHour} />
      </section>

      <section className="surface-card reporting-panel reporting-operation-panel">
        <div className="reporting-panel-heading"><div><span className="section-kicker">Semana</span><h2>Pedidos por dia da semana</h2></div></div>
        <HorizontalDistribution items={data.byWeekday} keyField="weekday" labelOf={(item) => weekdays[item.weekday]} />
      </section>

      <section className="surface-card reporting-panel reporting-operation-panel reporting-operation-modality-panel">
        <div className="reporting-panel-heading"><div><span className="section-kicker">Modalidades</span><h2>Desempenho por modalidade</h2></div></div>
        <ModalityPerformance items={data.byModality} />
      </section>

      <section className="surface-card reporting-panel reporting-operation-panel">
        <div className="reporting-panel-heading"><div><span className="section-kicker">Agendamento</span><h2>Imediatos x agendados</h2></div></div>
        <ScheduleSplit items={data.bySchedule} />
      </section>

      <section className="surface-card reporting-panel reporting-operation-panel reporting-operation-duration-panel">
        <div className="reporting-panel-heading"><div><span className="section-kicker">Duração</span><h2>Faixas de duração</h2></div></div>
        <HorizontalDistribution items={data.durationBands} keyField="label" labelOf={(item) => item.label} />
      </section>
    </div>
  </div> : null}</ReportingState>
}
