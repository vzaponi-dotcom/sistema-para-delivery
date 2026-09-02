import Button from '../components/Button'
import PageHeader from '../components/PageHeader'
import PaymentBadge from '../components/PaymentBadge'
import StatCard from '../components/StatCard'
import StatusBadge from '../components/StatusBadge'
import Icon from '../components/Icon'
import { getOrderItemsSummary } from '../utils/orderCart.js'
import { formatOrderDate } from '../utils/orderWorkflow'

function Dashboard({ totals, orders, currency, onNewOrder }) {
  const writeDisabled = typeof navigator !== 'undefined' && !navigator.onLine

  return (
    <>
      <PageHeader
        eyebrow="Resumo do dia"
        title="Visão geral da operação"
        description="Veja o que vendeu, o que já entrou no caixa e o que ainda precisa ser recebido."
        actions={<Button icon="plus" onClick={onNewOrder} disabled={writeDisabled}>Novo pedido</Button>}
      />

      <section className="stats-grid" aria-label="Indicadores principais">
        <StatCard label="Vendas hoje" value={currency(totals.salesToday)} helper="Pedidos da data de hoje" icon="receipt" tone="success" />
        <StatCard label="Recebido hoje" value={currency(totals.receivedToday)} helper="Pagamentos confirmados" icon="arrow-up" tone="success" />
        <StatCard label="A receber" value={currency(totals.receivables)} helper="Pagamentos pendentes" icon="wallet" tone="warning" />
        <StatCard label="Pedidos ativos" value={totals.activeOrders} helper="Na fila de preparo" icon="orders" />
      </section>

      <section className="surface-card dashboard-section">
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
                <strong>{currency(order.total)}</strong>
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
    </>
  )
}

export default Dashboard
