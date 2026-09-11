import { useMemo } from 'react'
import '../dashboard.css'
import '../area-navigation.css'
import DashboardBarChart from './DashboardBarChart'
import DashboardPeriodSelector from './DashboardPeriodSelector'
import StatCard from './StatCard'
import { calculateOperationalMetrics } from '../utils/dashboardAnalytics.js'

const PERIOD_HELPERS = {
  today: 'Somente hoje',
  '7d': 'Hoje + 6 dias anteriores',
  '30d': 'Hoje + 29 dias anteriores',
}

const formatOperationalMinutes = (value) => Number.isFinite(value)
  ? `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} min`
  : '—'

function OperationalHistoryAnalysis({ orders = [], period = '30d', onPeriodChange, now = new Date() }) {
  const operational = useMemo(
    () => calculateOperationalMetrics(orders, period, now),
    [now, orders, period],
  )
  const operationalBands = operational.bands.map((value, index) => ({ label: ['≤20 min', '21–30 min', '31–40 min', '>40 min'][index], value }))
  const operationalTypes = Object.entries(operational.byType).map(([label, value]) => ({ label, value }))

  return (
    <section className="operational-history-analysis surface-card dashboard-section" aria-labelledby="operational-history-title">
      <div className="operational-history-heading">
        <div>
          <span className="section-kicker">Operação</span>
          <h2 id="operational-history-title">Tempo operacional</h2>
          <p>{PERIOD_HELPERS[period] || PERIOD_HELPERS['30d']} · somente esta análise</p>
        </div>
        <DashboardPeriodSelector value={period} onChange={onPeriodChange} />
      </div>
      <div className="section-meta">Pedidos finalizados elegíveis</div>
      {!operational.sampleSize ? (
        <div className="dashboard-chart-empty">Sem pedidos concluídos elegíveis neste período</div>
      ) : (
        <>
          <div className="stats-grid stats-grid-three operational-history-summary">
            <StatCard label="Tempo médio" value={formatOperationalMinutes(operational.averageMinutes)} helper="Média do período" icon="clock" />
            <StatCard label="Mais rápido" value={formatOperationalMinutes(operational.fastestMinutes)} helper="Menor duração" icon="arrow-down" />
            <StatCard label="Mais demorado" value={formatOperationalMinutes(operational.slowestMinutes)} helper="Maior duração" icon="arrow-up" />
          </div>
          <div className="operational-history-charts">
            <article className="dashboard-chart-card">
              <div className="section-heading"><h3>Por faixa de tempo</h3></div>
              <DashboardBarChart data={operationalBands} valueKey="value" labelKey="label" formatValue={(value) => `${value} pedido(s)`} ariaLabel="Pedidos por faixa de tempo operacional" />
            </article>
            <article className="dashboard-chart-card">
              <div className="section-heading"><h3>Por tipo de atendimento</h3></div>
              <DashboardBarChart data={operationalTypes} valueKey="value" labelKey="label" formatValue={formatOperationalMinutes} orientation="horizontal" ariaLabel="Tempo operacional médio por tipo de atendimento" />
            </article>
          </div>
        </>
      )}
    </section>
  )
}

export default OperationalHistoryAnalysis
