export function ReportingMobileSummary({ metrics = {} }) {
  return <section className="reporting-mobile-summary" aria-label="Resumo mobile de relatórios"><h2>Resumo do período</h2><dl><dt>Vendas</dt><dd>{metrics.salesCents ?? 'Indisponível'}</dd><dt>Pedidos</dt><dd>{metrics.ordersCount ?? 'Indisponível'}</dd></dl><a href="/financeiro/a-receber">Ver em A receber</a></section>
}
