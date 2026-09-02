import { useMemo, useState } from 'react'
import '../dashboard.css'
import DashboardBarChart from '../components/DashboardBarChart'
import DashboardLineChart from '../components/DashboardLineChart'
import DashboardPaymentMix from '../components/DashboardPaymentMix'
import DashboardPeriodSelector from '../components/DashboardPeriodSelector'
import PageHeader from '../components/PageHeader'
import PaymentBadge from '../components/PaymentBadge'
import StatCard from '../components/StatCard'
import StatusBadge from '../components/StatusBadge'
import Icon from '../components/Icon'
import { useDashboardPeriod } from '../components/dashboardPeriodContext.js'
import {
  buildDailySeries,
  calculatePeriodMetrics,
  getPaymentMix,
  getTopProducts,
} from '../utils/dashboardAnalytics.js'
import { getOrderItemsSummary } from '../utils/orderCart.js'
import { formatOrderDate, toLocalDateValue } from '../utils/orderWorkflow'

const MONEY_MASK = '••••••'
const PERIOD_HELPERS = {
  today: 'Somente hoje',
  '7d': 'Hoje + 6 dias anteriores',
  '30d': 'Hoje + 29 dias anteriores',
}

function Dashboard({ totals, orders, currency, onNewOrder }) {
  const { period, setPeriod } = useDashboardPeriod()
  const [valuesVisible, setValuesVisible] = useState(true)
  const writeDisabled = typeof navigator !== 'undefined' && !navigator.onLine
  const todayValue = toLocalDateValue()

  const analytics = useMemo(() => {
    const now = new Date(`${todayValue}T12:00:00`)
    return {
      metrics: calculatePeriodMetrics(orders, period, now),
      daily: buildDailySeries(orders, period, now),
      topProducts: getTopProducts(orders, period, now),
      paymentMix: getPaymentMix(orders, period, now),
    }
  }, [orders, period, todayValue])

  const displayMoney = (value) => valuesVisible ? currency(value) : MONEY_MASK
  const privacyLabel = valuesVisible ? 'Ocultar valores' : 'Mostrar valores'
  const { metrics, daily, topProducts, paymentMix } = analytics

  return (
    <>
      <PageHeader
        eyebrow="Resumo do dia"
        title="Visão geral da operação"
        description="Acompanhe a operação de hoje e a evolução recente do negócio."
        actions={(
          <button
            type="button"
            className="icon-button icon-button-neutral dashboard-privacy-toggle"
            aria-label={privacyLabel}
            title={privacyLabel}
            onClick={() => setValuesVisible((current) => !current)}
          >
            <Icon name={valuesVisible ? 'eye' : 'eye-off'} size={20} />
          </button>
        )}
      />

      <section className="stats-grid" aria-label="Indicadores principais">
        <StatCard label="Vendas hoje" value={displayMoney(totals.salesToday)} helper="Pedidos da data de hoje" icon="receipt" tone="success" />
        <StatCard label="Recebido hoje" value={displayMoney(totals.receivedToday)} helper="Pagamentos confirmados" icon="arrow-up" tone="success" />
        <StatCard label="A receber" value={displayMoney(totals.receivables)} helper="Pagamentos pendentes" icon="wallet" tone="warning" />
        <StatCard label="Pedidos ativos" value={totals.activeOrders} helper="Na fila de preparo" icon="orders" />
      </section>

      <section className="dashboard-performance-section" aria-labelledby="dashboard-performance-title">
        <div className="dashboard-performance-heading">
          <div>
            <span className="section-kicker">Desempenho</span>
            <h2 id="dashboard-performance-title">Visão do período</h2>
            <p>{PERIOD_HELPERS[period]}</p>
          </div>
          <DashboardPeriodSelector value={period} onChange={setPeriod} />
        </div>

        <div className="stats-grid stats-grid-three dashboard-period-stats">
          <StatCard label="Vendas no período" value={displayMoney(metrics.sales)} helper="Valor dos pedidos registrados" icon="receipt" tone="success" />
          <StatCard label="Pedidos no período" value={metrics.orderCount} helper="Quantidade de pedidos" icon="orders" />
          <StatCard label="Ticket médio" value={displayMoney(metrics.averageTicket)} helper="Venda média por pedido" icon="ticket" />
        </div>
      </section>

      <section className="dashboard-analytics-grid" aria-label="Gráficos de desempenho">
        <article className="surface-card dashboard-chart-card">
          <div className="section-heading">
            <div><span className="section-kicker">Tendência</span><h2>Vendas por dia</h2></div>
            <div className="section-meta">{PERIOD_HELPERS[period]}</div>
          </div>
          <DashboardLineChart data={daily} valueKey="sales" labelKey="label" formatValue={currency} valuesVisible={valuesVisible} ariaLabel="Vendas por dia no período selecionado" />
        </article>

        <article className="surface-card dashboard-chart-card">
          <div className="section-heading">
            <div><span className="section-kicker">Volume</span><h2>Pedidos por dia</h2></div>
            <div className="section-meta">{metrics.orderCount} pedidos</div>
          </div>
          <DashboardBarChart data={daily} valueKey="orders" labelKey="label" formatValue={(value) => String(value)} ariaLabel="Pedidos por dia no período selecionado" />
        </article>

        <article className="surface-card dashboard-chart-card">
          <div className="section-heading">
            <div><span className="section-kicker">Produtos</span><h2>Top 5 produtos</h2></div>
            <div className="section-meta">Por unidades vendidas</div>
          </div>
          <DashboardBarChart data={topProducts} valueKey="quantity" labelKey="label" formatValue={(value) => `${value} un.`} orientation="horizontal" ariaLabel="Top 5 produtos por quantidade vendida" />
        </article>

        <article className="surface-card dashboard-chart-card">
          <div className="section-heading">
            <div><span className="section-kicker">Recebimentos</span><h2>Formas de pagamento</h2></div>
            <div className="section-meta">Pedidos pagos</div>
          </div>
          <DashboardPaymentMix data={paymentMix} formatValue={currency} valuesVisible={valuesVisible} ariaLabel="Valores recebidos por forma de pagamento" />
        </article>
      </section>

      <section className="surface-card dashboard-section dashboard-recent-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Operação</span>
            <h2>Pedidos recentes</h2>
          </div>
          <div className="section-meta"><Icon name="orders" size={18} /> Últimos registros</div>
        </div>

        <div className="recent-orders">
          {orders.slice(0, 6).map((order) => (
            <article className="recent-order" key={order.id}>
              <div className="recent-order-avatar">{order.client.charAt(0).toUpperCase()}</div>
              <div className="recent-order-main">
                <strong>{order.client}</strong>
                <span>{getOrderItemsSummary(order)} · {order.type}</span>
              </div>
              <div className="recent-order-statuses">
                <StatusBadge status={order.status} />
                <PaymentBadge order={order} />
              </div>
              <div className="recent-order-value">
                <strong>{displayMoney(order.total)}</strong>
                <span>{formatOrderDate(order.orderDate)}</span>
              </div>
            </article>
          ))}

          {!orders.length && (
            <div className="empty-state">
              <Icon name="orders" size={28} />
              <strong>Nenhum pedido registrado</strong>
              <span>Crie o primeiro pedido para começar a acompanhar a operação.</span>
            </div>
          )}
        </div>
      </section>

      <button
        type="button"
        className="button button-primary dashboard-new-order-fab"
        aria-label="Novo pedido"
        title="Novo pedido"
        onClick={onNewOrder}
        disabled={writeDisabled}
      >
        <Icon name="plus" size={24} />
      </button>
    </>
  )
}

export default Dashboard
