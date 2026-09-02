import { useMemo, useState } from 'react'
import '../receivables.css'
import Button from '../components/Button'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import PaymentBadge from '../components/PaymentBadge'
import StatCard from '../components/StatCard'
import { formatOrderDate, toLocalDateValue } from '../utils/orderWorkflow'
import { getPendingAmount, isOrderPaid } from '../utils/paymentWorkflow'

const orderNumber = (id) => String(id).slice(-4)

function Receivables({ orders, currency, onRegisterPayment }) {
  const [search, setSearch] = useState('')
  const today = toLocalDateValue()
  const normalizedSearch = search.trim().toLowerCase()
  const writeDisabled = typeof navigator !== 'undefined' && !navigator.onLine

  const pendingOrders = useMemo(
    () =>
      orders
        .filter((order) => !isOrderPaid(order))
        .filter((order) => {
          if (!normalizedSearch) return true
          return [order.client, order.productName, order.type, order.orderDate, String(order.id)]
            .join(' ')
            .toLowerCase()
            .includes(normalizedSearch)
        })
        .sort((a, b) => String(a.orderDate).localeCompare(String(b.orderDate))),
    [normalizedSearch, orders],
  )

  const groups = useMemo(() => {
    const grouped = new Map()

    pendingOrders.forEach((order) => {
      const current = grouped.get(order.client) || []
      current.push(order)
      grouped.set(order.client, current)
    })

    return [...grouped.entries()]
      .map(([client, clientOrders]) => ({
        client,
        orders: clientOrders,
        total: clientOrders.reduce((sum, order) => sum + getPendingAmount(order), 0),
      }))
      .sort((a, b) => b.total - a.total)
  }, [pendingOrders])

  const totalPending = orders
    .filter((order) => !isOrderPaid(order))
    .reduce((sum, order) => sum + getPendingAmount(order), 0)
  const pendingCount = orders.filter((order) => !isOrderPaid(order)).length
  const debtorCount = new Set(orders.filter((order) => !isOrderPaid(order)).map((order) => order.client)).size
  const receivedToday = orders
    .filter((order) => isOrderPaid(order) && order.paidAt && toLocalDateValue(order.paidAt) === today)
    .reduce((sum, order) => sum + Number(order.paidAmount || order.total || 0), 0)

  return (
    <>
      <PageHeader
        eyebrow="Financeiro"
        title="A receber"
        description="Acompanhe quem ainda não pagou e registre os recebimentos sem misturar pagamento com o andamento da cozinha."
      />

      <section className="stats-grid receivables-stats" aria-label="Resumo de recebimentos">
        <StatCard label="A receber" value={currency(totalPending)} helper="Saldo pendente" icon="wallet" tone="warning" />
        <StatCard label="Pedidos pendentes" value={pendingCount} helper="Ainda não pagos" icon="receipt" />
        <StatCard label="Clientes devendo" value={debtorCount} helper="Com saldo aberto" icon="clients" />
        <StatCard label="Recebido hoje" value={currency(receivedToday)} helper="Pagamentos confirmados" icon="arrow-up" tone="success" />
      </section>

      <section className="surface-card receivables-surface">
        <div className="toolbar">
          <label className="search-control">
            <Icon name="search" size={18} />
            <input
              type="search"
              placeholder="Buscar cliente, pedido ou produto"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <span className="receivables-toolbar-note">Mais antigos aparecem primeiro</span>
        </div>

        <div className="section-heading">
          <div>
            <span className="section-kicker">Cobrança</span>
            <h2>Pendências por cliente</h2>
          </div>
          <span className="toolbar-count">{groups.length} cliente(s)</span>
        </div>

        <div className="receivables-groups">
          {groups.map((group) => (
            <article className="receivable-client-card" key={group.client}>
              <header className="receivable-client-header">
                <div>
                  <div className="receivable-client-avatar">{group.client.charAt(0).toUpperCase()}</div>
                  <div className="receivable-client-copy">
                    <strong>{group.client}</strong>
                    <span>{group.orders.length} pedido(s) pendente(s)</span>
                  </div>
                </div>
                <div className="receivable-client-total">
                  <span>Total a receber</span>
                  <strong>{currency(group.total)}</strong>
                </div>
              </header>

              <div className="receivable-orders">
                {group.orders.map((order) => (
                  <div className="receivable-order-row" key={order.id}>
                    <div className="receivable-order-main">
                      <strong>Pedido #{orderNumber(order.id)} · {formatOrderDate(order.orderDate)}</strong>
                      <span>{order.productName || `Marmita ${order.size}`} · {order.quantity} un. · {order.type}</span>
                      <PaymentBadge order={order} />
                    </div>
                    <strong className="receivable-order-amount">{currency(getPendingAmount(order))}</strong>
                    <Button onClick={() => onRegisterPayment(order.id)} disabled={writeDisabled}>Registrar pagamento</Button>
                  </div>
                ))}
              </div>
            </article>
          ))}

          {!groups.length && (
            <div className="empty-state">
              <Icon name="wallet" size={28} />
              <strong>{search ? 'Nenhuma pendência encontrada' : 'Tudo recebido por aqui'}</strong>
              <span>{search ? 'Ajuste a busca para localizar outros clientes.' : 'Quando houver um pedido pendente, ele aparecerá automaticamente nesta tela.'}</span>
            </div>
          )}
        </div>
      </section>
    </>
  )
}

export default Receivables
