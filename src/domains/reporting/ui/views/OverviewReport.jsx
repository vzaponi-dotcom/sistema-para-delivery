import { ReportingMetricCard } from '../ReportingMetricCard.jsx'
import { ReportingState } from '../ReportingState.jsx'

export function OverviewReport({ state, onDrilldown = () => {} }) {
  const metrics = state.data?.metrics
  return <ReportingState state={state}>{metrics ? <>
    <section className="reporting-metric-grid" aria-label="Indicadores da visão geral">
      <ReportingMetricCard label="Vendas registradas" value={metrics.salesCents} comparison={state.comparison?.metrics?.salesCents} />
      <ReportingMetricCard label="Pedidos" value={metrics.ordersCount} kind="number" comparison={state.comparison?.metrics?.ordersCount} onDrilldown={() => onDrilldown({ view: 'detail' })} />
      <ReportingMetricCard label="Ticket médio" value={metrics.averageTicketCents} comparison={state.comparison?.metrics?.averageTicketCents} />
      <ReportingMetricCard label="Recebido no período" value={metrics.receivedCents} comparison={state.comparison?.metrics?.receivedCents} />
      <ReportingMetricCard label="A receber do período" value={metrics.receivableCents} comparison={state.comparison?.metrics?.receivableCents} onDrilldown={() => onDrilldown({ view: 'detail', receivable: 'unpaid', status: null })} />
      <ReportingMetricCard label="Taxa de cancelamento" value={metrics.cancellationRate} kind="percent" comparison={state.comparison?.metrics?.cancellationRate} onDrilldown={() => onDrilldown({ view: 'detail', status: 'Cancelado' })} />
      <ReportingMetricCard label="Estornos" value={metrics.refundsCents} comparison={state.comparison?.metrics?.refundsCents} />
      <ReportingMetricCard label="Dentro do prazo" value={metrics.withinDeadlineRate} kind="percent" comparison={state.comparison?.metrics?.withinDeadlineRate} onDrilldown={() => onDrilldown({ view: 'detail', operationalDeadline: 'on-time' })} />
    </section>
    {state.warnings?.map((warning) => <p role="status" key={warning}>{warning}</p>)}
    <a className="button secondary-button" href="/financeiro/a-receber">Gerenciar em A receber</a>
  </> : <section className="surface-card reporting-shell-state">Nenhum dado no período selecionado.</section>}</ReportingState>
}
