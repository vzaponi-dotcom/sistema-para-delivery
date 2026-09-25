import { ReportingMetricCard } from '../ReportingMetricCard.jsx'
import { ReportingState } from '../ReportingState.jsx'

const money = (cents) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
const series = (items = [], kind = 'money') => <ul className="reporting-series">{items.map((item) => <li key={item.date}><time dateTime={item.date}>{item.date}</time><strong>{kind === 'money' ? money(item.cents) : `${item.count} pedidos`}</strong></li>)}</ul>

export function SalesReport({ state }) {
  const data = state.data
  const comparison = state.comparison?.metrics || {}
  return <ReportingState state={state}>{data ? <>
    <section className="reporting-metric-grid" aria-label="Indicadores de vendas">
      <ReportingMetricCard label="Vendas registradas" value={data.salesCents} comparison={comparison.salesCents} />
      <ReportingMetricCard label="Pedidos" value={data.ordersCount} kind="number" comparison={comparison.ordersCount} />
      <ReportingMetricCard label="Ticket médio" value={data.averageTicketCents} comparison={comparison.averageTicketCents} />
      <ReportingMetricCard label="Recebido no período" value={data.receivedCents} comparison={comparison.receivedCents} />
      <ReportingMetricCard label="Receita de mercadoria" value={data.merchandiseRevenueCents} />
      <ReportingMetricCard label="Taxas de entrega" value={data.deliveryFeesCents} />
      <ReportingMetricCard label="Descontos" value={data.discountCents} />
      <ReportingMetricCard label="Acréscimos" value={data.surchargeCents} />
      <ReportingMetricCard label="A receber do período" value={data.receivableCents} comparison={comparison.receivableCents} />
      <ReportingMetricCard label="Cancelamentos" value={data.cancellationCount} kind="number" />
      <ReportingMetricCard label="Estornos" value={data.refundsCents} />
    </section>
    <div className="reporting-panel-grid">
      <section className="surface-card reporting-panel"><h2>Vendas por dia</h2>{series(data.salesSeries)}</section>
      <section className="surface-card reporting-panel"><h2>Pedidos por dia</h2>{series(data.ordersSeries, 'count')}</section>
      <section className="surface-card reporting-panel"><h2>Recebimentos por dia</h2>{series(data.receivedSeries)}</section>
    </div>
    <div className="reporting-panel-grid">
      <section className="surface-card reporting-panel"><h2>Mix por forma de pagamento</h2><ul>{data.paymentMix.map((item) => <li key={item.method}>{item.method}: {money(item.amountCents)}</li>)}</ul></section>
      <section className="surface-card reporting-panel"><h2>A receber do período</h2><p>{data.receivableCount} pedidos · {money(data.receivableCents)}</p><ul><li>Vencidos: {data.receivables?.overdue.count ?? 0} · {money(data.receivables?.overdue.amountCents ?? 0)}</li><li>Hoje: {data.receivables?.today.count ?? 0} · {money(data.receivables?.today.amountCents ?? 0)}</li><li>Futuros: {data.receivables?.upcoming.count ?? 0} · {money(data.receivables?.upcoming.amountCents ?? 0)}</li></ul></section>
      <section className="surface-card reporting-panel"><h2>Estornos por dia</h2>{series(data.refundSeries)}</section>
    </div>
    {state.warnings?.map((warning) => <p role="status" key={warning}>{warning}</p>)}
    <a className="button secondary-button" href="/financeiro/a-receber">Gerenciar em A receber</a>
  </> : null}</ReportingState>
}
