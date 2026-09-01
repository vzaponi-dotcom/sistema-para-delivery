import Button from '../components/Button'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'

function Orders({ orders, search, onSearchChange, currency, onNewOrder, onDeleteOrder }) {
  return (
    <>
      <PageHeader
        eyebrow="Operação"
        title="Pedidos"
        description="Consulte pedidos, acompanhe status e registre novas vendas."
        actions={<Button icon="plus" onClick={onNewOrder}>Novo pedido</Button>}
      />

      <section className="surface-card">
        <div className="toolbar">
          <label className="search-control">
            <Icon name="search" size={18} />
            <input
              type="search"
              placeholder="Buscar por cliente, tipo, tamanho ou data"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </label>
          <span className="toolbar-count">{orders.length} pedido(s)</span>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Produto</th>
                <th>Qtd.</th>
                <th>Total</th>
                <th>Data</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td><strong className="table-primary">{order.client}</strong></td>
                  <td>{order.type}</td>
                  <td><StatusBadge status={order.status} /></td>
                  <td>{order.productName || `Marmita ${order.size}`}</td>
                  <td>{order.quantity}</td>
                  <td><strong>{currency(order.total)}</strong></td>
                  <td>{order.date}</td>
                  <td className="table-actions">
                    <button
                      type="button"
                      className="icon-button icon-button-danger"
                      aria-label={`Excluir pedido de ${order.client}`}
                      title="Excluir pedido"
                      onClick={() => onDeleteOrder(order.id)}
                    >
                      <Icon name="trash" size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!orders.length && (
          <div className="empty-state">
            <Icon name="search" size={28} />
            <strong>Nenhum pedido encontrado</strong>
            <span>Ajuste sua busca ou registre um novo pedido.</span>
          </div>
        )}
      </section>
    </>
  )
}

export default Orders
