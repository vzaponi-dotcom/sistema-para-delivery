import { useEffect, useState } from 'react'

const PERIOD_OPTIONS = [
  { key: 'today', label: 'Hoje' },
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
]

function FinancePeriodSelector({ value, today, onChange }) {
  const [customRange, setCustomRange] = useState(() => ({
    startDate: value?.key === 'custom' ? value.startDate : today,
    endDate: value?.key === 'custom' ? value.endDate : today,
  }))

  useEffect(() => {
    if (value?.key !== 'custom') return
    setCustomRange({ startDate: value.startDate, endDate: value.endDate })
  }, [value])

  const selectPreset = (key) => onChange({ key })

  const selectCustom = () => {
    const startDate = customRange.startDate || today
    const endDate = customRange.endDate || today
    setCustomRange({ startDate, endDate })
    if (startDate <= endDate) onChange({ key: 'custom', startDate, endDate })
  }

  const updateCustom = (field, nextValue) => {
    const nextRange = { ...customRange, [field]: nextValue }
    setCustomRange(nextRange)
    if (nextRange.startDate && nextRange.endDate && nextRange.startDate <= nextRange.endDate) {
      onChange({ key: 'custom', ...nextRange })
    }
  }

  return (
    <section className="finance-period" aria-label="Período financeiro">
      <div className="finance-period-presets" role="group" aria-label="Período rápido">
        {PERIOD_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`finance-period-button${value?.key === option.key ? ' active' : ''}`}
            aria-pressed={value?.key === option.key}
            onClick={() => selectPreset(option.key)}
          >
            {option.label}
          </button>
        ))}
        <button
          type="button"
          className={`finance-period-button${value?.key === 'custom' ? ' active' : ''}`}
          aria-pressed={value?.key === 'custom'}
          onClick={selectCustom}
        >
          Personalizado
        </button>
      </div>

      {value?.key === 'custom' && (
        <div className="finance-custom-period">
          <label>
            <span>De</span>
            <input type="date" value={customRange.startDate || ''} max={today} onChange={(event) => updateCustom('startDate', event.target.value)} />
          </label>
          <label>
            <span>Até</span>
            <input type="date" value={customRange.endDate || ''} max={today} onChange={(event) => updateCustom('endDate', event.target.value)} />
          </label>
          {customRange.startDate && customRange.endDate && customRange.startDate > customRange.endDate && (
            <span className="finance-period-error">A data inicial deve ser anterior à final.</span>
          )}
        </div>
      )}
    </section>
  )
}

export default FinancePeriodSelector
