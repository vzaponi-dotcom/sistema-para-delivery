import { ReportingMetricCard } from '../ReportingMetricCard.jsx'
import { ReportingState } from '../ReportingState.jsx'
import Icon from '../../../../shared/ui/Icon.jsx'

const moneyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const numberFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
const money = (cents) => moneyFormatter.format(Number(cents || 0) / 100)
const shortMoney = (cents) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1,
}).format(Number(cents || 0) / 100)
const dateLabel = (date) => {
  const [year, month, day] = String(date || '').split('-')
  return year && month && day ? `${day}/${month}` : String(date || '')
}
const safeNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function EmptySalesPanel({ message }) {
  return <div className="reporting-sales-empty">
    <span className="reporting-sales-empty-icon"><Icon name="chart" size={20} /></span>
    <strong>{message}</strong>
    <span>O painel será preenchido quando houver movimentação no período selecionado.</span>
  </div>
}

function SalesLineChart({ items = [], valueKey = 'cents', ariaLabel, formatAxis = shortMoney }) {
  if (!items.length) return <EmptySalesPanel message="Sem movimentação no período" />
  const width = 680, height = 230, left = 68, right = 20, top = 18, bottom = 34
  const values = items.map((item) => safeNumber(item?.[valueKey]))
  const max = Math.max(0, ...values)
  const scale = max || 1
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const x = (index) => items.length <= 1 ? left + plotWidth / 2 : left + index * plotWidth / (items.length - 1)
  const y = (value) => top + plotHeight - safeNumber(value) * plotHeight / scale
  const points = items.map((item, index) => `${x(index)},${y(item?.[valueKey])}`).join(' ')
  const tickIndexes = new Set(items.length <= 1 ? [0] : [0, Math.round((items.length - 1) / 2), items.length - 1])

  return <div className="reporting-sales-chart reporting-sales-line-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} preserveAspectRatio="xMidYMid meet">
      {[1, .5, 0].map((ratio) => {
        const yy = top + plotHeight * (1 - ratio)
        return <g key={ratio}><line className="reporting-sales-chart-grid" x1={left} x2={width - right} y1={yy} y2={yy} /><text className="reporting-sales-chart-axis" x={left - 8} y={yy + 4} textAnchor="end">{formatAxis(max * ratio)}</text></g>
      })}
      <polyline className="reporting-sales-line-path" fill="none" points={points} />
      {items.map((item, index) => <circle className="reporting-sales-line-point" cx={x(index)} cy={y(item?.[valueKey])} r="3.5" key={item.date ?? index} />)}
      {items.map((item, index) => tickIndexes.has(index) ? <text className="reporting-sales-chart-axis" x={x(index)} y={height - 9} textAnchor="middle" key={`label-${item.date ?? index}`}>{dateLabel(item.date)}</text> : null)}
    </svg>
  </div>
}

function SalesBarChart({ items = [], valueKey = 'count', ariaLabel }) {
  if (!items.length) return <EmptySalesPanel message="Nenhum pedido no período" />
  const width = 680, height = 230, left = 48, right = 20, top = 18, bottom = 34
  const max = Math.max(0, ...items.map((item) => safeNumber(item?.[valueKey])))
  const scale = max || 1
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const slot = plotWidth / Math.max(1, items.length)
  const barWidth = Math.max(5, slot * .58)
  const tickIndexes = new Set(items.length <= 1 ? [0] : [0, Math.round((items.length - 1) / 2), items.length - 1])

  return <div className="reporting-sales-chart reporting-sales-bar-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} preserveAspectRatio="xMidYMid meet">
      {[1, .5, 0].map((ratio) => {
        const yy = top + plotHeight * (1 - ratio)
        return <g key={ratio}><line className="reporting-sales-chart-grid" x1={left} x2={width - right} y1={yy} y2={yy} /><text className="reporting-sales-chart-axis" x={left - 8} y={yy + 4} textAnchor="end">{Math.round(max * ratio)}</text></g>
      })}
      {items.map((item, index) => {
        const value = safeNumber(item?.[valueKey])
        const barHeight = value * plotHeight / scale
        const xx = left + index * slot + (slot - barWidth) / 2
        return <rect className="reporting-sales-bar" x={xx} y={top + plotHeight - barHeight} width={barWidth} height={barHeight} rx="4" key={item.date ?? index} />
      })}
      {items.map((item, index) => tickIndexes.has(index) ? <text className="reporting-sales-chart-axis" x={left + index * slot + slot / 2} y={height - 9} textAnchor="middle" key={`label-${item.date ?? index}`}>{dateLabel(item.date)}</text> : null)}
    </svg>
  </div>
}

function PaymentMixPanel({ items = [], onDrilldown }) {
  const ordered = [...items].sort((left, right) => Number(right.amountCents || 0) - Number(left.amountCents || 0))
  const total = ordered.reduce((sum, item) => sum + Number(item.amountCents || 0), 0)
  if (!ordered.length || total <= 0) return <EmptySalesPanel message="Sem recebimentos no período" />

  return <div className="reporting-payment-mix">{ordered.map((item) => {
    const amount = Number(item.amountCents || 0)
    const share = total ? amount * 100 / total : 0
    return <button type="button" className="reporting-payment-row" onClick={() => onDrilldown({ view: 'detail', paymentMethod: item.method })} key={item.method}>
      <span className="reporting-payment-copy"><span>{item.method}</span><strong>{money(amount)}</strong></span>
      <span className="reporting-payment-meta">{numberFormatter.format(share)}%</span>
      <span className="reporting-payment-track" aria-hidden="true"><i style={{ width: `${share}%` }} /></span>
    </button>
  })}</div>
}

function ReceivablePanel({ data }) {
  const segments = [
    { key: 'overdue', label: 'Vencidos', tone: 'danger', value: data.receivables?.overdue },
    { key: 'today', label: 'Hoje', tone: 'warning', value: data.receivables?.today },
    { key: 'upcoming', label: 'Futuros', tone: 'info', value: data.receivables?.upcoming },
  ]
  const total = Math.max(0, Number(data.receivableCents || 0))

  return <div className="reporting-receivable-panel">
    <div className="reporting-receivable-summary"><div><span>A receber</span><strong>{money(total)}</strong></div><span className="reporting-panel-badge">{data.receivableCount || 0} pedido(s)</span></div>
    <div className="reporting-receivable-track" aria-label="Distribuição do valor a receber">{segments.map((segment) => {
      const amount = Number(segment.value?.amountCents || 0)
      const width = total ? amount * 100 / total : 0
      return width > 0 ? <span key={segment.key} className={`is-${segment.tone}`} style={{ width: `${width}%` }} /> : null
    })}</div>
    <div className="reporting-receivable-breakdown">{segments.map((segment) => <div key={segment.key}><span><i className={`reporting-receivable-dot is-${segment.tone}`} />{segment.label}</span><strong>{money(segment.value?.amountCents || 0)}</strong><small>{segment.value?.count || 0} pedido(s)</small></div>)}</div>
    <a className="button secondary-button reporting-receivable-action" href="/financeiro/a-receber">Gerenciar em A receber</a>
  </div>
}

function RefundPanel({ items = [] }) {
  if (!items.length) return <EmptySalesPanel message="Nenhum estorno no período" />
  return <SalesLineChart items={items} ariaLabel="Estornos por dia no período selecionado" />
}

export function SalesReport({ state, onDrilldown = () => {} }) {
  const data = state.data
  const comparison = state.comparison?.metrics || {}
  const paymentMix = Array.isArray(data?.paymentMix) ? data.paymentMix : []
  const salesSeries = Array.isArray(data?.salesSeries) ? data.salesSeries : []
  const ordersSeries = Array.isArray(data?.ordersSeries) ? data.ordersSeries : []
  const receivedSeries = Array.isArray(data?.receivedSeries) ? data.receivedSeries : []
  const refundSeries = Array.isArray(data?.refundSeries) ? data.refundSeries : []

  return <ReportingState state={state}>{data ? <div className="reporting-view-stack reporting-sales-view">
    <div className="reporting-view-heading"><div><span className="section-kicker">Financeiro</span><h2>Vendas e recebimentos</h2><p>Compare o valor vendido com o que efetivamente entrou no caixa e acompanhe a composição financeira do período.</p></div></div>

    <section className="reporting-metric-grid reporting-sales-primary-metrics" aria-label="Indicadores principais de vendas">
      <ReportingMetricCard label="Vendas registradas" value={data.salesCents} comparison={comparison.salesCents} />
      <ReportingMetricCard label="Pedidos" value={data.ordersCount} kind="number" comparison={comparison.ordersCount} />
      <ReportingMetricCard label="Ticket médio" value={data.averageTicketCents} comparison={comparison.averageTicketCents} />
      <ReportingMetricCard label="Recebido no período" value={data.receivedCents} comparison={comparison.receivedCents} />
    </section>

    <section className="reporting-metric-grid reporting-sales-secondary-metrics" aria-label="Composição financeira">
      <ReportingMetricCard label="Receita de mercadoria" value={data.merchandiseRevenueCents} />
      <ReportingMetricCard label="Taxas de entrega" value={data.deliveryFeesCents} />
      <ReportingMetricCard label="A receber do período" value={data.receivableCents} comparison={comparison.receivableCents} onDrilldown={() => onDrilldown({ view: 'detail', receivable: 'unpaid' })} />
      <ReportingMetricCard label="Estornos" value={data.refundsCents} />
      <ReportingMetricCard label="Descontos" value={data.discountCents} />
      <ReportingMetricCard label="Acréscimos" value={data.surchargeCents} />
      <ReportingMetricCard label="Cancelamentos" value={data.cancellationCount} kind="number" />
    </section>

    <div className="reporting-sales-analytics-grid">
      <section className="surface-card reporting-panel reporting-sales-chart-panel"><div className="reporting-panel-heading"><div><span className="section-kicker">Vendas</span><h2>Vendas por dia</h2></div><span className="reporting-panel-badge">Por data do pedido</span></div><SalesLineChart items={salesSeries} ariaLabel="Vendas por dia no período selecionado" /></section>
      <section className="surface-card reporting-panel reporting-sales-chart-panel"><div className="reporting-panel-heading"><div><span className="section-kicker">Volume</span><h2>Pedidos por dia</h2></div><span className="reporting-panel-badge">{data.ordersCount || 0} pedido(s)</span></div><SalesBarChart items={ordersSeries} ariaLabel="Pedidos por dia no período selecionado" /></section>
      <section className="surface-card reporting-panel reporting-sales-chart-panel"><div className="reporting-panel-heading"><div><span className="section-kicker">Caixa</span><h2>Recebimentos por dia</h2></div><span className="reporting-panel-badge">Por data de pagamento</span></div><SalesLineChart items={receivedSeries} ariaLabel="Recebimentos por dia no período selecionado" /></section>
      <section className="surface-card reporting-panel reporting-sales-chart-panel"><div className="reporting-panel-heading"><div><span className="section-kicker">Pagamento</span><h2>Mix por forma de pagamento</h2></div><span className="reporting-panel-badge">{money(data.receivedCents)}</span></div><PaymentMixPanel items={paymentMix} onDrilldown={onDrilldown} /></section>
      <section className="surface-card reporting-panel reporting-sales-chart-panel"><div className="reporting-panel-heading"><div><span className="section-kicker">Pendências</span><h2>A receber do período</h2></div></div><ReceivablePanel data={data} /></section>
      <section className="surface-card reporting-panel reporting-sales-chart-panel"><div className="reporting-panel-heading"><div><span className="section-kicker">Ajustes</span><h2>Estornos por dia</h2></div><span className="reporting-panel-badge">{money(data.refundsCents)}</span></div><RefundPanel items={refundSeries} /></section>
    </div>

    <aside className="reporting-sales-note" role="note"><span className="reporting-sales-note-icon"><Icon name="details" size={18} /></span><div><strong>Como interpretar estes números</strong><span>Vendas seguem a data do pedido; recebimentos seguem a data do pagamento e a forma selecionada; estornos seguem a data do movimento financeiro.</span></div></aside>
    {state.warnings?.filter(Boolean).map((warning) => <p className="reporting-warning" role="status" key={warning}>{warning}</p>)}
  </div> : null}</ReportingState>
}
