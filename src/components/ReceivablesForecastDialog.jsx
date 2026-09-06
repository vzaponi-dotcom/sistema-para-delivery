import Modal from './Modal'
import { formatOrderDate } from '../utils/orderWorkflow.js'

const countLabel = (count) => `${count} ${count === 1 ? 'recebimento' : 'recebimentos'}`

function ForecastMetric({ label, amount, count, currency, tone = '' }) {
  return (
    <div className={`receivables-forecast-metric${tone ? ` receivables-forecast-metric-${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{currency(amount || 0)}</strong>
      <small>{countLabel(count || 0)}</small>
    </div>
  )
}

function ReceivablesForecastDialog({ forecast, receivedToday, currency, onClose, onSelectDate }) {
  const dayAmounts = forecast?.days?.map((day) => Number(day.amount || 0)) || []
  const maxDayAmount = Math.max(...dayAmounts, 1)

  return (
    <Modal title="Previsão de recebimentos" onClose={onClose}>
      <div className="receivables-forecast-dialog">
        <p className="receivables-forecast-intro">Valores pendentes organizados pela data esperada de pagamento. O recebido hoje aparece separado do que ainda está previsto.</p>

        <div className="receivables-forecast-metrics" aria-label="Resumo da previsão">
          <ForecastMetric label="Em atraso" amount={forecast?.overdue?.amount} count={forecast?.overdue?.count} currency={currency} tone="danger" />
          <ForecastMetric label="Hoje" amount={forecast?.today?.amount} count={forecast?.today?.count} currency={currency} tone="warning" />
          <ForecastMetric label="Depois" amount={forecast?.later?.amount} count={forecast?.later?.count} currency={currency} />
          <div className="receivables-forecast-metric receivables-forecast-metric-realized">
            <span>Recebido hoje</span>
            <strong>{currency(receivedToday || 0)}</strong>
            <small>Valor já realizado</small>
          </div>
        </div>

        <section className="receivables-forecast-days" aria-label="Próximos 7 dias">
          <div className="receivables-forecast-section-heading">
            <strong>Próximos 7 dias</strong>
            <span>Toque em uma data para filtrar a lista.</span>
          </div>
          <div className="receivables-forecast-day-list">
            {forecast.days.map((day) => {
              const width = `${Math.max(4, Math.round((Number(day.amount || 0) / maxDayAmount) * 100))}%`
              return (
                <button key={day.date} type="button" className="receivables-forecast-day" onClick={() => onSelectDate(day.date)}>
                  <span className="receivables-forecast-day-copy">
                    <strong>{formatOrderDate(day.date)}</strong>
                    <small>{countLabel(day.count || 0)}</small>
                  </span>
                  <span className="receivables-forecast-day-value">{currency(day.amount || 0)}</span>
                  <span className="receivables-forecast-bar" aria-hidden="true"><span style={{ width }} /></span>
                </button>
              )
            })}
          </div>
        </section>
      </div>
    </Modal>
  )
}

export default ReceivablesForecastDialog
