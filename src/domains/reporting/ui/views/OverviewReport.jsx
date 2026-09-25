import { ReportingMetricCard } from '../ReportingMetricCard.jsx'
import { ReportingState } from '../ReportingState.jsx'

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

const moneyValue = (cents) => cents == null ? 'Indisponível' : money.format(Number(cents) / 100)
const comparisonCopy = (comparison, kind = 'money') => {
  if (!comparison?.available || comparison.percent == null) return 'Sem base comparável no período anterior'
  const sign = comparison.percent > 0 ? '+' : ''
  const current = kind === 'percent' ? `${number.format(comparison.current)}%` : kind === 'number' ? number.format(comparison.current) : moneyValue(comparison.current)
  return `${sign}${number.format(comparison.percent)}% vs. período anterior · atual ${current}`
}

export function OverviewReport({ state, onDrilldown = () => {} }) {
  const metrics = state.data?.metrics
  const comparisons = state.comparison?.metrics || {}
  const received = Number(metrics?.receivedCents || 0)
  const pending = Number(metrics?.receivableCents || 0)
  const financialTotal = received + pending
  const receivedShare = financialTotal > 0 ? received * 100 / financialTotal : 0

  return <ReportingState state={state}>{metrics ? <div className="reporting-view-stack">
    <div className="reporting-view-heading">
      <div><span className="section-kicker">Resumo executivo</span><h2>Visão geral do período</h2><p>Os principais números do negócio em um único painel, com comparação histórica e acesso rápido aos detalhes.</p></div>
      <span className="reporting-generated-at">Atualizado com dados oficiais do período</span>
    </div>

    <section className="reporting-metric-grid reporting-overview-metrics" aria-label="Indicadores da visão geral">
      <ReportingMetricCard label="Vendas registradas" value={metrics.salesCents} comparison={comparisons.salesCents} />
      <ReportingMetricCard label="Pedidos" value={metrics.ordersCount} kind="number" comparison={comparisons.ordersCount} onDrilldown={() => onDrilldown({ view: 'detail' })} />
      <ReportingMetricCard label="Ticket médio" value={metrics.averageTicketCents} comparison={comparisons.averageTicketCents} />
      <ReportingMetricCard label="Recebido no período" value={metrics.receivedCents} comparison={comparisons.receivedCents} />
      <ReportingMetricCard label="A receber do período" value={metrics.receivableCents} comparison={comparisons.receivableCents} onDrilldown={() => onDrilldown({ view: 'detail', receivable: 'unpaid', status: null })} />
      <ReportingMetricCard label="Taxa de cancelamento" value={metrics.cancellationRate} kind="percent" comparison={comparisons.cancellationRate} onDrilldown={() => onDrilldown({ view: 'detail', status: 'Cancelado' })} />
      <ReportingMetricCard label="Estornos" value={metrics.refundsCents} comparison={comparisons.refundsCents} />
      <ReportingMetricCard label="Dentro do prazo" value={metrics.withinDeadlineRate} kind="percent" comparison={comparisons.withinDeadlineRate} onDrilldown={() => onDrilldown({ view: 'detail', operationalDeadline: 'on-time' })} />
    </section>

    <div className="reporting-overview-grid">
      <section className="surface-card reporting-panel reporting-overview-panel">
        <div className="reporting-panel-heading">
          <div><span className="section-kicker">Desempenho</span><h2>Evolução contra o período anterior</h2></div>
          <span className="reporting-panel-badge">Comparativo</span>
        </div>
        <div className="reporting-comparison-list">
          <div><span>Vendas</span><strong>{moneyValue(metrics.salesCents)}</strong><small>{comparisonCopy(comparisons.salesCents)}</small></div>
          <div><span>Pedidos</span><strong>{number.format(metrics.ordersCount || 0)}</strong><small>{comparisonCopy(comparisons.ordersCount, 'number')}</small></div>
          <div><span>Ticket médio</span><strong>{moneyValue(metrics.averageTicketCents)}</strong><small>{comparisonCopy(comparisons.averageTicketCents)}</small></div>
          <div><span>Prazo operacional</span><strong>{metrics.withinDeadlineRate == null ? 'Indisponível' : `${number.format(metrics.withinDeadlineRate)}%`}</strong><small>{comparisonCopy(comparisons.withinDeadlineRate, 'percent')}</small></div>
        </div>
      </section>

      <section className="surface-card reporting-panel reporting-overview-panel">
        <div className="reporting-panel-heading">
          <div><span className="section-kicker">Financeiro</span><h2>Recebido x a receber</h2></div>
          <span className="reporting-panel-badge">{financialTotal ? `${number.format(receivedShare)}% recebido` : 'Sem movimento'}</span>
        </div>
        <div className="reporting-money-split">
          <div className="reporting-money-split-track" aria-label={financialTotal ? `${number.format(receivedShare)}% recebido` : 'Sem movimento financeiro'}>
            <span style={{ width: `${receivedShare}%` }} />
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
