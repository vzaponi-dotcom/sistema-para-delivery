import { useMemo } from 'react'
import { useReportingData } from '../../application/useReportingData.js'
import { ReportingMetricCard } from '../ReportingMetricCard.jsx'
import { ReportingReceivableLink } from '../ReportingReceivableLink.jsx'

const money = (cents) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
const forView = (query, view) => ({
  ...query, view, page: 1, pageSize: 25, sort: 'date-desc', search: '',
  paymentMethod: ['sales', 'detail'].includes(view) ? query.paymentMethod : null,
  operationalDeadline: ['operation', 'detail'].includes(view) ? query.operationalDeadline : null,
  orderHourFrom: ['operation', 'detail'].includes(view) ? query.orderHourFrom : null,
  orderHourTo: ['operation', 'detail'].includes(view) ? query.orderHourTo : null,
  status: ['overview', 'sales', 'detail'].includes(view) ? query.status : null,
  receivable: view === 'detail' ? query.receivable : null,
})

export function ReportingMobileSummary({ query, detailState, onDrilldown = () => {}, api }) {
  const overviewQuery = useMemo(() => forView(query, 'overview'), [query])
  const operationQuery = useMemo(() => forView(query, 'operation'), [query])
  const salesQuery = useMemo(() => forView(query, 'sales'), [query])
  const productsQuery = useMemo(() => forView(query, 'products'), [query])
  const overview = useReportingData({ query: overviewQuery, api })
  const operation = useReportingData({ query: operationQuery, api })
  const sales = useReportingData({ query: salesQuery, api })
  const products = useReportingData({ query: productsQuery, api })
  const metrics = overview.data?.metrics
  return <div className="reporting-mobile-summary" aria-label="Resumo mobile de relatórios">
    <section className="surface-card reporting-panel"><h2>Resumo do período</h2>
      {overview.loading && !metrics ? <p>Carregando métricas…</p> : overview.error && !metrics ? <p role="alert">Não foi possível carregar o resumo.</p> : metrics ? <div className="reporting-mobile-kpis">
        <ReportingMetricCard label="Vendas" value={metrics.salesCents} comparison={overview.comparison?.metrics?.salesCents} />
        <ReportingMetricCard label="Pedidos" value={metrics.ordersCount} kind="number" comparison={overview.comparison?.metrics?.ordersCount} />
        <ReportingMetricCard label="Ticket médio" value={metrics.averageTicketCents} comparison={overview.comparison?.metrics?.averageTicketCents} />
        <ReportingMetricCard label="A receber" value={metrics.receivableCents} comparison={overview.comparison?.metrics?.receivableCents} />
      </div> : <p>Nenhum dado no período.</p>}
      <ReportingReceivableLink className="reporting-mobile-receivable-link" />
    </section>
    <section className="surface-card reporting-panel"><h2>Tendência de vendas</h2>{sales.data?.salesSeries?.length ? <ul className="reporting-mobile-trend">{sales.data.salesSeries.map((item) => <li key={item.date}><time dateTime={item.date}>{item.date}</time><strong>{money(item.cents)}</strong></li>)}</ul> : <p>{sales.loading ? 'Carregando…' : 'Sem vendas no período.'}</p>}</section>
    <section className="surface-card reporting-panel"><h2>Top produtos</h2>{products.data?.top10?.length ? <ol>{products.data.top10.slice(0, 5).map((item) => <li key={item.id}><button type="button" onClick={() => onDrilldown(item.id)}>{item.name}</button><span>{item.quantity} un. · {money(item.revenueCents)}</span></li>)}</ol> : <p>{products.loading ? 'Carregando…' : 'Sem produtos no período.'}</p>}</section>
    <section className="surface-card reporting-panel"><h2>Resumo da operação</h2>{operation.data ? <p>{operation.data.operationalOrdersCount} pedidos · Tempo médio {operation.data.averageDurationMinutes ?? 'Indisponível'} min · Dentro do prazo {operation.data.withinDeadlineRate ?? 'Indisponível'}%</p> : <p>{operation.loading ? 'Carregando…' : 'Dados indisponíveis.'}</p>}{operation.warnings?.map((warning) => <p role="status" key={warning}>{warning}</p>)}</section>
    <section className="surface-card reporting-panel"><h2>Resumo de vendas</h2>{sales.data ? <p>Vendas {money(sales.data.salesCents)} · Recebido {money(sales.data.receivedCents)}</p> : <p>{sales.loading ? 'Carregando…' : 'Dados indisponíveis.'}</p>}</section>
    {query.view === 'detail' ? <section className="surface-card reporting-panel"><h2>Pedidos detalhados</h2>{detailState.data?.items?.length ? <ul>{detailState.data.items.map((item) => <li key={item.id}>#{item.order_number} · {item.client_name_snapshot} · {money(item.total_cents)}</li>)}</ul> : <p>Nenhum pedido encontrado.</p>}<p>Colunas avançadas disponíveis na versão desktop.</p></section> : null}
  </div>
}
