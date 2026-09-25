const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
const isAvailable = (value) => value !== null && value !== undefined && Number.isFinite(Number(value))
const format = (value, kind) => {
  if (!isAvailable(value)) return 'Indisponível'
  if (kind === 'money') return money.format(Number(value) / 100)
  if (kind === 'percent') return `${number.format(Number(value))}%`
  return number.format(Number(value))
}

export function ReportingMetricCard({ label, value, kind = 'money', comparison }) {
  const change = comparison?.delta
  const trend = isAvailable(change) && change !== 0 && comparison?.direction !== 'neutral'
    ? (change > 0) === (comparison?.direction === 'higher_better') ? 'Melhora' : 'Piora'
    : null
  return <article className="surface-card reporting-metric-card">
    <span>{label}</span><strong>{format(value, kind)}</strong>
    {comparison ? <small>
      {comparison.available && isAvailable(comparison.percent)
        ? <>{change > 0 ? '+' : ''}{number.format(comparison.percent)}%{trend ? ` · ${trend}` : ''} vs. período anterior ({format(comparison.previous, kind)})</>
        : <>Comparação indisponível{isAvailable(comparison.previous) ? ` · anterior: ${format(comparison.previous, kind)}` : ''}</>}
    </small> : null}
  </article>
}
