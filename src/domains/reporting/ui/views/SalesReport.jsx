import { ReportingMetricCard } from '../ReportingMetricCard.jsx'
import { ReportingState } from '../ReportingState.jsx'

export function SalesReport({ state }) {
  const data = state.data
  return <ReportingState state={state}>{data ? <>
    <section className="reporting-metric-grid" aria-label="Indicadores de vendas">
      <ReportingMetricCard label="Vendas registradas" value={data.salesCents} />
      <ReportingMetricCard label="Recebido no período" value={data.receivedCents} />
      <ReportingMetricCard label="Receita de mercadoria" value={data.merchandiseRevenueCents} />
      <ReportingMetricCard label="Taxas de entrega" value={data.deliveryFeesCents} />
    </section>
    <section className="surface-card"><h2>Mix por forma de pagamento</h2><ul>{data.paymentMix.map((item) => <li key={item.method}>{item.method}: {item.amountCents}</li>)}</ul></section>
    <a className="button secondary-button" href="/financeiro/a-receber">Gerenciar em A receber</a>
  </> : null}</ReportingState>
}
