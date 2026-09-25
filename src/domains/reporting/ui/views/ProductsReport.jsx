import { ReportingMetricCard } from '../ReportingMetricCard.jsx'
import { ReportingState } from '../ReportingState.jsx'

const money = (cents) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)

export function ProductsReport({ state, onDrilldown = () => {} }) {
  const data = state.data
  return <ReportingState state={state}>{data ? <div className="reporting-view-stack">
    <section className="reporting-metric-grid" aria-label="Indicadores de produtos">
      <ReportingMetricCard label="Unidades vendidas" value={data.unitsSold} kind="number" comparison={state.comparison?.metrics?.unitsSold} />
      <ReportingMetricCard label="Refeições vendidas" value={data.mealsSold} kind="number" comparison={state.comparison?.metrics?.mealsSold} />
      <ReportingMetricCard label="Receita de mercadoria" value={data.merchandiseRevenueCents} comparison={state.comparison?.metrics?.merchandiseRevenueCents} />
      <ReportingMetricCard label="Produtos no período" value={data.ranking.length} kind="number" />
    </section>
    <div className="reporting-panel-grid">
      <section className="surface-card reporting-panel"><h2>Top 10 produtos</h2>
        {data.top10.length ? <ol className="reporting-ranking">{data.top10.map((item) => <li key={item.id}>
          <button type="button" onClick={() => onDrilldown(item.id)}>{item.name}{item.size ? ` · ${item.size}` : ''}</button>
          <span>{item.quantity} un.</span><strong>{money(item.revenueCents)}</strong>
        </li>)}</ol> : <p>Nenhum produto vendido no período.</p>}
      </section>
      <section className="surface-card reporting-panel"><h2>Receita por categoria</h2><ul className="reporting-bars">
        {data.categories.map((item) => <li key={item.category}><span>{item.category || 'Sem categoria'}</span><meter min="0" max={data.merchandiseRevenueCents || 1} value={item.revenueCents}>{money(item.revenueCents)}</meter><strong>{money(item.revenueCents)}</strong></li>)}
      </ul></section>
    </div>
    <div className="reporting-panel-grid">
      <section className="surface-card reporting-panel"><h2>Ranking completo</h2><div className="reporting-table-scroll"><table><thead><tr><th>Produto</th><th>Categoria</th><th>Unidades</th><th>Receita</th><th>Participação</th><th>Variação</th></tr></thead><tbody>
        {data.ranking.map((item) => <tr key={item.id}><td><button type="button" onClick={() => onDrilldown(item.id)}>{item.name}</button></td><td>{item.category}</td><td>{item.quantity}</td><td>{money(item.revenueCents)}</td><td>{item.sharePercent.toLocaleString('pt-BR')}%</td><td>{item.growthPercent == null ? 'Indisponível' : `${item.growthPercent > 0 ? '+' : ''}${item.growthPercent.toLocaleString('pt-BR')}%`}</td></tr>)}
      </tbody></table></div></section>
      <section className="surface-card reporting-panel"><h2>Apresentações e tamanhos</h2><ul>{data.presentations.map((item) => <li key={`${item.productId}|${item.size}`}>{item.name} · {item.size || 'Padrão'}: {item.quantity} un. · {money(item.revenueCents)}</li>)}</ul></section>
    </div>
  </div> : null}</ReportingState>
}
