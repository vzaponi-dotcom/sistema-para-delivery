import Icon from '../../../../shared/ui/Icon.jsx'
import { ReportingMetricCard } from '../ReportingMetricCard.jsx'
import { ReportingState } from '../ReportingState.jsx'

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

const moneyValue = (cents) => cents == null ? 'Indisponível' : money.format(Number(cents) / 100)
const valueFor = (value, kind = 'money') => value == null
  ? 'Indisponível'
  : kind === 'percent' ? `${number.format(value)}%`
    : kind === 'number' ? number.format(value)
      : moneyValue(value)

const comparisonCopy = (comparison) => {
  if (!comparison?.available || comparison.percent == null) return 'Sem base comparável no período anterior'
  const sign = comparison.percent > 0 ? '+' : ''
  return `${sign}${number.format(comparison.percent)}% vs. período anterior`
}

const comparisonWidths = (comparison) => {
  const current = Number(comparison?.current)
  const previous = Number(comparison?.previous)
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return { current: 0, previous: 0 }
  const ceiling = Math.max(Math.abs(current), Math.abs(previous), 1)
  return {
    current: Math.max(3, Math.abs(current) * 100 / ceiling),
    previous: Math.max(3, Math.abs(previous) * 100 / ceiling),
  }
}

function ComparisonVisualRow({ label, value, comparison, kind = 'money' }) {
  const available = Boolean(comparison?.available && comparison?.percent != null)
  const widths = available ? comparisonWidths(comparison) : null
  return <div className="reporting-comparison-visual-row">
    <div className="reporting-comparison-visual-copy">
      <span>{label}</span>
      <strong>{valueFor(value, kind)}</strong>
      <small>{comparisonCopy(comparison)}</small>
    </div>
    {available ? <div className="reporting-comparison-bars" aria-label={`${label}: atual ${valueFor(value, kind)}, anterior ${valueFor(comparison?.previous, kind)}`}>
      <div><span>Atual</span><div className="reporting-comparison-track is-current"><i style={{ width: `${widths.current}%` }} /></div></div>
      <div><span>Anterior</span><div className="reporting-comparison-track is-previous"><i style={{ width: `${widths.previous}%` }} /></div></div>
    </div> : <div className="reporting-comparison-unavailable" role="note">
      <span className="reporting-comparison-unavailable-dot" />
      <span>Comparação indisponível para este recorte</span>
    </div>}
  </div>
}

const formatGeneratedAt = (value) => {
  if (!value) return 'Dados oficiais do período'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Dados oficiais do período'
  return `Atualizado ${new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(parsed)}`
}

export function OverviewReport({ state, onDrilldown = () => {} }) {
  const metrics = state.data?.metrics
  const comparisons = state.comparison?.metrics || {}
  const received = Number(metrics?.receivedCents || 0)
  const pending = Number(metrics?.receivableCents || 0)
  const financialTotal = received + pending
  const receivedShare = financialTotal > 0 ? received * 100 / financialTotal : 0
  const pendingShare = financialTotal > 0 ? pending * 100 / financialTotal : 0
  const comparisonKeys = ['salesCents', 'ordersCount', 'averageTicketCents', 'withinDeadlineRate']
  const hasOverviewComparison = comparisonKeys.some((key) => comparisons[key]?.available && comparisons[key]?.percent != null)

  return <ReportingState state={state}>{metrics ? <div className="reporting-view-stack reporting-overview-view">
    <div className="reporting-view-heading">
      <div><span className="section-kicker">Resumo executivo</span><h2>Visão geral do período</h2><p>Os principais números do negócio em um único painel, com comparação histórica e acesso rápido aos detalhes.</p></div>
      <span className="reporting-view-meta"><span className="reporting-status-dot" />{formatGeneratedAt(state.generatedAt)}</span>
    </div>

    <section className="reporting-metric-grid reporting-overview-metrics" aria-label="Indicadores da visão geral">
      <ReportingMetricCard className="reporting-overview-metric is-primary" compactComparison label="Vendas registradas" value={metrics.salesCents} comparison={comparisons.salesCents} />
      <ReportingMetricCard className="reporting-overview-metric is-primary" compactComparison label="Pedidos" value={metrics.ordersCount} kind="number" comparison={comparisons.ordersCount} onDrilldown={() => onDrilldown({ view: 'detail' })} />
      <ReportingMetricCard className="reporting-overview-metric is-primary" compactComparison label="Ticket médio" value={metrics.averageTicketCents} comparison={comparisons.averageTicketCents} />
      <ReportingMetricCard className="reporting-overview-metric is-primary" compactComparison label="Dentro do prazo" value={metrics.withinDeadlineRate} kind="percent" comparison={comparisons.withinDeadlineRate} onDrilldown={() => onDrilldown({ view: 'detail', operationalDeadline: 'on-time' })} />
      <ReportingMetricCard className="reporting-overview-metric is-secondary" compactComparison label="Recebido no período" value={metrics.receivedCents} comparison={comparisons.receivedCents} />
      <ReportingMetricCard className="reporting-overview-metric is-secondary" compactComparison label="A receber do período" value={metrics.receivableCents} comparison={comparisons.receivableCents} onDrilldown={() => onDrilldown({ view: 'detail', receivable: 'unpaid', status: null })} />
      <ReportingMetricCard className="reporting-overview-metric is-secondary" compactComparison label="Taxa de cancelamento" value={metrics.cancellationRate} kind="percent" comparison={comparisons.cancellationRate} onDrilldown={() => onDrilldown({ view: 'detail', status: 'Cancelado' })} />
      <ReportingMetricCard className="reporting-overview-metric is-secondary" compactComparison label="Estornos" value={metrics.refundsCents} comparison={comparisons.refundsCents} />
    </section>

    <div className="reporting-overview-grid">
      <section className="surface-card reporting-panel reporting-overview-panel">
        <div className="reporting-panel-heading">
          <div><span className="section-kicker">Desempenho</span><h2>Evolução contra o período anterior</h2></div>
          <span className="reporting-panel-badge">Atual x anterior</span>
        </div>
        {hasOverviewComparison ? <div className="reporting-comparison-visual-list">
          <ComparisonVisualRow label="Vendas" value={metrics.salesCents} comparison={comparisons.salesCents} />
          <ComparisonVisualRow label="Pedidos" value={metrics.ordersCount} comparison={comparisons.ordersCount} kind="number" />
          <ComparisonVisualRow label="Ticket médio" value={metrics.averageTicketCents} comparison={comparisons.averageTicketCents} />
          <ComparisonVisualRow label="Prazo operacional" value={metrics.withinDeadlineRate} comparison={comparisons.withinDeadlineRate} kind="percent" />
        </div> : <div className="reporting-overview-comparison-empty">
          <span className="reporting-overview-comparison-empty-icon"><Icon name="chart" size={20} /></span>
          <div>
            <strong>Sem período comparável</strong>
            <p>Este recorte ainda não possui uma base anterior equivalente para mostrar evolução.</p>
          </div>
        </div>}
      </section>

      <section className="surface-card reporting-panel reporting-overview-panel">
        <div className="reporting-panel-heading reporting-overview-financial-heading">
          <div>
            <span className="section-kicker">Financeiro</span>
            <h2>Recebido x a receber</h2>
            <p>{financialTotal ? `${number.format(receivedShare)}% do total financeiro já recebido` : 'Sem movimento financeiro no período'}</p>
          </div>
        </div>
        <div className="reporting-money-split">
          <div className="reporting-money-split-track" aria-label={financialTotal ? `${number.format(receivedShare)}% recebido e ${number.format(pendingShare)}% a receber` : 'Sem movimento financeiro'}>
            <span className="is-received" style={{ width: `${receivedShare}%` }} />
            <span className="is-pending" style={{ width: `${pendingShare}%` }} />
          </div>
          <div className="reporting-money-split-legend">
            <div><span className="reporting-legend-dot is-received" /><span>Recebido</span><strong>{moneyValue(metrics.receivedCents)}</strong></div>
            <div><span className="reporting-legend-dot is-pending" /><span>A receber</span><strong>{moneyValue(metrics.receivableCents)}</strong></div>
          </div>
        </div>
        <div className="reporting-overview-footer">
          <span>{metrics.receivableCount ?? 0} pedido(s) pendente(s) no recorte</span>
          <a className="button secondary-button" href="/financeiro/a-receber">Gerenciar em A receber</a>
        </div>
      </section>
    </div>

    {state.warnings?.map((warning) => <p className="reporting-warning" role="status" key={warning}>{warning}</p>)}
  </div> : <section className="surface-card reporting-shell-state">Nenhum dado no período selecionado.</section>}</ReportingState>
}
