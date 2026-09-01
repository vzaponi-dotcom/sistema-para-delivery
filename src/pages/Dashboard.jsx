import Button from '../components/Button'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import StatusBadge from '../components/StatusBadge'
import Icon from '../components/Icon'

function Dashboard({ totals, orders, currency, onNewOrder }) {
  return (
    <>
      <PageHeader
        eyebrow="Resumo do dia"
        title="Visão geral da operação"
        description="Acompanhe os principais números do delivery e os pedidos mais recentes."
        actions={<Button icon="plus" onClick={onNewOrder}>Novo pedido</Button>}
      />

      <section className="stats-grid" aria-label="Indicadores principais">
        <StatCard label="Faturamento" value={currency(totals.revenue)} helper="Total registrado" icon="wallet" tone="success" />
        <StatCard label="Pedidos" value={totals.totalOrders} helper="No período" icon="receipt" />
        <StatCard label="Ticket médio" value={currency(totals.averageTicket)} helper="Média por pedido" icon="ticket" />
        <StatCard label="Itens vendidos" value={totals.soldUnits} helper="Unidades registradas" icon="package" tone="warning" />
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
                <span>{order.productName || `Marmita ${order.size}`} · {order.quantity} un. · {order.type}</span>
              </div>
              <StatusBadge status={order.status} />
              <div className="recent-order-value">
                <strong>{currency(order.total)}</strong>
                <span>{order.date}</span>
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
