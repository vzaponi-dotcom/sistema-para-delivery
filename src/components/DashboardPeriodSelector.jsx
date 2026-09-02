const OPTIONS = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
]

function DashboardPeriodSelector({ value, onChange }) {
  return (
    <div className="dashboard-period-selector" role="group" aria-label="Período da análise">
      {OPTIONS.map((option) => (
        <button
          type="button"
          className={`dashboard-period-option${value === option.value ? ' active' : ''}`}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          key={option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export default DashboardPeriodSelector
