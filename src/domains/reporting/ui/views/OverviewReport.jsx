import { ReportingMetricCard } from '../ReportingMetricCard.jsx'
import { ReportingState } from '../ReportingState.jsx'

export function OverviewReport({ state }) {
  const metrics = state.data?.metrics
  return <ReportingState state={state}>{metrics ? <>
    <section className="reporting-metric-grid" aria-label="Indicadores da visão geral">
      <ReportingMetricCard label="Vendas registradas" value={metrics.salesCents} comparison={state.comparison} />
      <ReportingMetricCard label="Pedidos" value={metrics.ordersCount} kind="number" comparison={state.comparison} />
      <ReportingMetricCard label="Ticket médio" value={metrics.averageTicketCents} comparison={state.comparison} />
      <ReportingMetricCard label="Recebido no período" value={metrics.receivedCents} comparison={state.comparison} />
      <ReportingMetricCard label="A receber do período" value={metrics.receivableCents} comparison={state.comparison} />
      <ReportingMetricCard label="Taxa de cancelamento" value={metrics.cancellationRate} kind="percent" comparison={state.comparison} />
      <ReportingMetricCard label="Estornos" value={metrics.refundsCents} comparison={state.comparison} />
    </section>
    <a className="button secondary-button" href="/financeiro/a-receber">Gerenciar em A receber</a>
  </> : <section className="surface-card reporting-shell-state">Nenhum dado no período selecionado.</section>}</ReportingState>
}
