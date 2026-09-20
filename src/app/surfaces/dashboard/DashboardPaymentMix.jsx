const MASK = '••••••'
const safeNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : 0
}

function DashboardPaymentMix({ data = [], formatValue = (value) => String(value), valuesVisible = true, ariaLabel = 'Formas de pagamento' }) {
  const total = data.reduce((sum, item) => sum + safeNumber(item.amount), 0)

  if (!data.length || total <= 0) {
    return <div className="dashboard-chart-empty">Nenhum pagamento recebido no período.</div>
  }

  const accessibleSummary = valuesVisible
    ? data.map((item) => `${item.method}: ${formatValue(item.amount)}`).join(', ')
    : 'Valores ocultos.'

  return (
    <div className="dashboard-payment-mix" role="img" aria-label={`${ariaLabel}. ${accessibleSummary}`}>
      <div className="dashboard-payment-track" aria-hidden="true">
        {data.map((item, index) => (
          <span
            className={`dashboard-payment-segment dashboard-series-${index % 6 + 1}`}
            style={{ width: `${safeNumber(item.amount) * 100 / total}%` }}
            key={item.method}
          />
        ))}
      </div>
      <div className="dashboard-payment-legend">
        {data.map((item, index) => (
          <div className="dashboard-payment-legend-row" key={item.method}>
            <span className={`dashboard-payment-dot dashboard-series-${index % 6 + 1}`} aria-hidden="true" />
            <span>{item.method}</span>
            <strong>{valuesVisible ? formatValue(item.amount) : MASK}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

export default DashboardPaymentMix
