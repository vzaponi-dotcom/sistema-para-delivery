const formatMoney = (cents) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((Number(cents) || 0) / 100)

export function ReportingMetricCard({ label, value, kind = 'money', comparison }) {
  const formatted = kind === 'money' ? formatMoney(value) : kind === 'percent' ? `${Number(value || 0).toLocaleString('pt-BR')}%` : Number(value || 0).toLocaleString('pt-BR')
  return <article className="surface-card reporting-metric-card"><span>{label}</span><strong>{formatted}</strong>{comparison?.available === false ? <small>Comparação indisponível</small> : null}</article>
}
