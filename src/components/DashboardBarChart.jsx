const WIDTH = 640
const HEIGHT = 220
const LEFT = 48
const RIGHT = 18
const TOP = 18
const BOTTOM = 34

const safeNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : 0
}

const xTickIndexes = (length) => {
  if (length <= 1) return new Set([0])
  return new Set([0, Math.round((length - 1) / 4), Math.round((length - 1) / 2), Math.round((length - 1) * 3 / 4), length - 1])
}

function DashboardBarChart({
  data = [],
  valueKey = 'value',
  labelKey = 'label',
  formatValue = (value) => String(value),
  orientation = 'vertical',
  ariaLabel = 'Gráfico de barras',
}) {
  const maxValue = Math.max(0, ...data.map((row) => safeNumber(row?.[valueKey])))
  const scaleMax = maxValue || 1

  if (orientation === 'horizontal') {
    if (!data.length) return <div className="dashboard-chart-empty">Nenhum produto vendido no período.</div>

    return (
      <div className="dashboard-horizontal-bars" role="img" aria-label={ariaLabel}>
        {data.map((row, index) => {
          const value = safeNumber(row?.[valueKey])
          const width = `${Math.max(0, value * 100 / scaleMax)}%`
          return (
            <div className="dashboard-horizontal-bar-row" key={row.key ?? row?.[labelKey] ?? index}>
              <div className="dashboard-horizontal-bar-copy"><span>{row?.[labelKey]}</span><strong>{formatValue(value)}</strong></div>
              <div className="dashboard-horizontal-bar-track" aria-hidden="true"><span style={{ width }} /></div>
            </div>
          )
        })}
      </div>
    )
  }

  const plotWidth = WIDTH - LEFT - RIGHT
  const plotHeight = HEIGHT - TOP - BOTTOM
  const slotWidth = data.length ? plotWidth / data.length : plotWidth
  const barWidth = Math.max(4, slotWidth * 0.58)
  const ticks = xTickIndexes(data.length)

  return (
    <div className="dashboard-chart dashboard-bar-chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={ariaLabel} preserveAspectRatio="xMidYMid meet">
        {[1, 0.5, 0].map((ratio) => {
          const tickY = TOP + plotHeight * (1 - ratio)
          return (
            <g key={ratio}>
              <line className="dashboard-chart-grid" x1={LEFT} x2={WIDTH - RIGHT} y1={tickY} y2={tickY} />
              <text className="dashboard-chart-axis" x={LEFT - 8} y={tickY + 4} textAnchor="end">{Math.round(maxValue * ratio)}</text>
            </g>
          )
        })}
        {data.map((row, index) => {
          const value = safeNumber(row?.[valueKey])
          const height = value * plotHeight / scaleMax
          const barX = LEFT + index * slotWidth + (slotWidth - barWidth) / 2
          return <rect className="dashboard-bar-rect" x={barX} y={TOP + plotHeight - height} width={barWidth} height={height} rx="3" key={row.date ?? index} />
        })}
        {data.map((row, index) => ticks.has(index) ? (
          <text className="dashboard-chart-axis dashboard-chart-x-label" x={LEFT + index * slotWidth + slotWidth / 2} y={HEIGHT - 8} textAnchor="middle" key={`label-${row.date ?? index}`}>
            {row?.[labelKey]}
          </text>
        ) : null)}
      </svg>
    </div>
  )
}

export default DashboardBarChart
