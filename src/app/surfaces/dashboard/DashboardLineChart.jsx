const WIDTH = 640
const HEIGHT = 220
const LEFT = 64
const RIGHT = 18
const TOP = 18
const BOTTOM = 34
const MASK = '••••'

const safeNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : 0
}

const xTickIndexes = (length) => {
  if (length <= 1) return new Set([0])
  return new Set([0, Math.round((length - 1) / 4), Math.round((length - 1) / 2), Math.round((length - 1) * 3 / 4), length - 1])
}

function DashboardLineChart({
  data = [],
  valueKey = 'value',
  labelKey = 'label',
  formatValue = (value) => String(value),
  formatAxisValue = formatValue,
  valuesVisible = true,
  ariaLabel = 'Gráfico de linha',
}) {
  const values = data.map((row) => safeNumber(row?.[valueKey]))
  const maxValue = Math.max(0, ...values)
  const scaleMax = maxValue || 1
  const plotWidth = WIDTH - LEFT - RIGHT
  const plotHeight = HEIGHT - TOP - BOTTOM
  const x = (index) => data.length <= 1 ? LEFT + plotWidth / 2 : LEFT + index * plotWidth / (data.length - 1)
  const y = (value) => TOP + plotHeight - safeNumber(value) * plotHeight / scaleMax
  const points = data.map((row, index) => `${x(index)},${y(row?.[valueKey])}`).join(' ')
  const ticks = xTickIndexes(data.length)
  const accessibleLabel = valuesVisible ? ariaLabel : `${ariaLabel}. Valores ocultos.`

  return (
    <div className="dashboard-chart dashboard-line-chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={accessibleLabel} preserveAspectRatio="xMidYMid meet">
        {[1, 0.5, 0].map((ratio) => {
          const tickY = TOP + plotHeight * (1 - ratio)
          return (
            <g key={ratio}>
              <line className="dashboard-chart-grid" x1={LEFT} x2={WIDTH - RIGHT} y1={tickY} y2={tickY} />
              <text className="dashboard-chart-axis" x={LEFT - 8} y={tickY + 4} textAnchor="end">
                {valuesVisible ? formatAxisValue(maxValue * ratio) : MASK}
              </text>
            </g>
          )
        })}
        <polyline className="dashboard-line-path" fill="none" points={points} />
        {data.map((row, index) => <circle className="dashboard-line-point" cx={x(index)} cy={y(row?.[valueKey])} r="3.5" key={row.date ?? index} />)}
        {data.map((row, index) => ticks.has(index) ? (
          <text className="dashboard-chart-axis dashboard-chart-x-label" x={x(index)} y={HEIGHT - 8} textAnchor="middle" key={`label-${row.date ?? index}`}>
            {row?.[labelKey]}
          </text>
        ) : null)}
      </svg>
    </div>
  )
}

export default DashboardLineChart
