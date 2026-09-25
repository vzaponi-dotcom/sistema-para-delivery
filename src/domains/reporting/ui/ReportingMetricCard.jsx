import Icon from '../../../shared/ui/Icon.jsx'

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
const isAvailable = (value) => value !== null && value !== undefined && Number.isFinite(Number(value))
const format = (value, kind) => {
  if (!isAvailable(value)) return 'Indisponível'
  if (kind === 'money') return money.format(Number(value) / 100)
  if (kind === 'percent') return `${number.format(Number(value))}%`
  return number.format(Number(value))
}
const iconFor = (label) => ({
  'Vendas registradas': 'receipt',
  'Vendas': 'receipt',
  'Pedidos': 'orders',
  'Pedidos operacionais': 'orders',
  'Ticket médio': 'ticket',
  'Recebido no período': 'arrow-up',
  'A receber do período': 'wallet',
  'A receber': 'wallet',
  'Taxa de cancelamento': 'percent',
  'Cancelamentos': 'cancel',
  'Estornos': 'transfer',
  'Dentro do prazo': 'clock',
  'Fora do prazo': 'alert',
  'Tempo médio': 'clock',
  'Mediana': 'clock',
  'P90': 'clock',
  'Mais rápido': 'bolt',
  'Mais lento': 'clock',
  'Atraso médio': 'alert',
  'Pontualidade agendada': 'clock',
  'Receita de mercadoria': 'finance',
  'Taxas de entrega': 'delivery',
  'Descontos': 'percent',
  'Acréscimos': 'plus',
  'Unidades vendidas': 'package',
  'Refeições vendidas': 'meal',
  'Produtos no período': 'products',
}[label] || 'chart')

export function ReportingMetricCard({ label, value, kind = 'money', comparison, onDrilldown }) {
  const change = comparison?.delta
  const trend = isAvailable(change) && change !== 0 && comparison?.direction !== 'neutral'
    ? (change > 0) === (comparison?.direction === 'higher_better') ? 'Melhora' : 'Piora'
    : null
  const Root = onDrilldown ? 'button' : 'article'
  const trendClass = trend === 'Melhora' ? 'is-positive' : trend === 'Piora' ? 'is-negative' : ''

  return <Root type={onDrilldown ? 'button' : undefined} onClick={onDrilldown} className="surface-card reporting-metric-card" aria-label={onDrilldown ? `Ver detalhes: ${label}` : undefined}>
    <div className="reporting-metric-heading">
      <span className="reporting-metric-icon"><Icon name={iconFor(label)} size={18} /></span>
      <span className="reporting-metric-label">{label}</span>
    </div>
    <strong>{format(value, kind)}</strong>
    {comparison ? <small className={`reporting-comparison ${trendClass}`}>
      {comparison.available && isAvailable(comparison.percent)
        ? <><span className="reporting-comparison-pill">{change > 0 ? '+' : ''}{number.format(comparison.percent)}%</span><span>{trend ? `${trend} · ` : ''}vs. anterior {format(comparison.previous, kind)}</span></>
        : <><span className="reporting-comparison-pill is-neutral">—</span><span>Comparação indisponível{isAvailable(comparison.previous) ? ` · anterior ${format(comparison.previous, kind)}` : ''}</span></>}
    </small> : <small className="reporting-comparison"><span>Período selecionado</span></small>}
  </Root>
}
