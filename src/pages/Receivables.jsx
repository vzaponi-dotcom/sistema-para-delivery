import { useMemo, useState } from 'react'
import '../receivables.css'
import Button from '../components/Button'
import Icon from '../components/Icon'
import Modal from '../components/Modal'
import OrderDetail from '../components/OrderDetail'
import PageHeader from '../components/PageHeader'
import PaymentBadge from '../components/PaymentBadge'
import StatCard from '../components/StatCard'
import SystemSelect from '../components/SystemSelect'
import { getOrderItemsSearchText, getOrderItemsSummary } from '../utils/orderCart.js'
import { formatOrderDate, toLocalDateValue } from '../utils/orderWorkflow'
import { getPendingAmount, isOrderPaid } from '../utils/paymentWorkflow'
import { groupPendingOrders } from '../utils/receivables.js'

const orderNumber = (id) => String(id).slice(-4)
const PAYMENT_METHOD_OPTIONS = ['Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Transferência', 'Outro']
  .map((value) => ({ value, label: value }))

function Receivables({ orders, tableTabs = [], currency, onRegisterPayment, onRegisterTableTabPayment }) {
  const [search, setSearch] = useState('')
  const [detailOrder, setDetailOrder] = useState(null)
  const [tableTabPaymentGroup, setTableTabPaymentGroup] = useState(null)
  const [tableTabPaymentMethod, setTableTabPaymentMethod] = useState('Pix')
  const today = toLocalDateValue()
  const normalizedSearch = search.trim().toLowerCase()
  const writeDisabled = typeof navigator !== 'undefined' && !navigator.onLine

  const pendingOrders = useMemo(
    () =>
      orders
        .filter((order) => !isOrderPaid(order))
        .filter((order) => {
          if (!normalizedSearch) return true
          return [order.client, getOrderItemsSearchText(order), order.type, order.orderDate, String(order.id)]
            .join(' ')
            .toLowerCase()
            .includes(normalizedSearch)
        })
        .sort((a, b) => String(a.orderDate).localeCompare(String(b.orderDate))),
    [normalizedSearch, orders],
  )

  const groups = useMemo(() => {
    const tabsById = new Map(tableTabs.map((tab) => [tab.id, tab]))
    return groupPendingOrders(pendingOrders).map((group) => {
      if (group.kind !== 'table_tab') return group
      const tab = tabsById.get(group.tableTabId)
      return tab?.tableIdentifier ? { ...group, label: `Mesa ${tab.tableIdentifier}` } : group
    })
  }, [pendingOrders, tableTabs])

  const totalPending = orders
    .filter((order) => !isOrderPaid(order))
    .reduce((sum, order) => sum + getPendingAmount(order), 0)
  const pendingCount = orders.filter((order) => !isOrderPaid(order)).length
  const receivedToday = orders
    .filter((order) => isOrderPaid(order) && order.paidAt && toLocalDateValue(order.paidAt) === today)
    .reduce((sum, order) => sum + Number(order.paidAmount || order.total || 0), 0)

  const openTableTabPayment = (group) => {
    setTableTabPaymentMethod('Pix')
    setTableTabPaymentGroup(group)
  }

  const closeTableTabPayment = () => {
    setTableTabPaymentGroup(null)
    setTableTabPaymentMethod('Pix')
  }

  const confirmTableTabPayment = async () => {
    if (!tableTabPaymentGroup || writeDisabled || !onRegisterTableTabPayment) return
    const success = await onRegisterTableTabPayment(tableTabPaymentGroup.tableTabId, tableTabPaymentMethod)
    if (success) closeTableTabPayment()
  }

  return (
    <>
      <PageHeader
        eyebrow="Financeiro"
        title="A receber"
        description="Acompanhe os pedidos ainda não pagos e registre os recebimentos sem misturar pagamento com o andamento da cozinha."
      />

      <section className="stats-grid receivables-stats" aria-label="Resumo de recebimentos">
        <StatCard label="A receber" value={currency(totalPending)} helper="Saldo pendente" icon="wallet" tone="warning" />
        <StatCard label="Pedidos pendentes" value={pendingCount} helper="Ainda não pagos" icon="receipt" />
        <StatCard label="Recebido hoje" value={currency(receivedToday)} helper="Pagamentos confirmados" icon="arrow-up" tone="success" />
      </section>

      <section className="surface-card receivables-surface">
        <div className="toolbar">
          <label className="search-control">
            <Icon name="search" size={18} />
            <input
              type="search"
              placeholder="Buscar identificação, pedido ou produto"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <span className="receivables-toolbar-note">Mais antigos aparecem primeiro</span>
        </div>

        <div className="section-heading">
          <div>
            <span className="section-kicker">Cobrança</span>
            <h2>Pendências por identificação</h2>
          </div>
          <span className="toolbar-count">{groups.length} grupo(s)</span>
        </div>

        <div className="receivables-groups">
          {groups.map((group) => (
            <article className={`receivable-client-card${group.kind === 'table_tab' ? ' receivable-table-tab-card' : ''}`} key={group.key}>
              <header className="receivable-client-header">
                <div>
                  <div className="receivable-client-avatar">{group.label.charAt(0).toUpperCase()}</div>
                  <div className="receivable-client-copy">
                    <strong>{group.label}</strong>
                    <span>{group.orders.length} pedido(s) pendente(s){group.kind === 'table_tab' ? ' nesta comanda' : ''}</span>
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
                      <span>{getOrderItemsSummary(order)} · {order.type}</span>
                      <PaymentBadge order={order} />
                    </div>
                    <strong className="receivable-order-amount">{currency(getPendingAmount(order))}</strong>
                    <div className="receivable-order-actions">
                      <Button type="button" variant="secondary" onClick={() => setDetailOrder(order)}>Ver detalhes</Button>
                      {group.kind !== 'table_tab' && (
                        <Button onClick={() => onRegisterPayment(order.id)} disabled={writeDisabled}>Registrar pagamento</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {group.kind === 'table_tab' && (
                <div className="receivable-table-tab-action">
                  <div>
                    <strong>Cobrança única da comanda</strong>
                    <span>Quite todos os pedidos pendentes desta mesa de uma vez.</span>
                  </div>
                  <Button
                    type="button"
                    className="table-tab-payment-action-button"
                    onClick={() => openTableTabPayment(group)}
                    disabled={writeDisabled || !onRegisterTableTabPayment}
                  >
                    Registrar pagamento da comanda
                  </Button>
                </div>
              )}
            </article>
          ))}

          {!groups.length && (
            <div className="empty-state">
              <Icon name="wallet" size={28} />
              <strong>{search ? 'Nenhuma pendência encontrada' : 'Tudo recebido por aqui'}</strong>
              <span>{search ? 'Ajuste a busca para localizar outros pedidos.' : 'Quando houver um pedido pendente, ele aparecerá automaticamente nesta tela.'}</span>
            </div>
          )}
        </div>
      </section>

      {detailOrder && <OrderDetail order={detailOrder} currency={currency} onClose={() => setDetailOrder(null)} />}

      {tableTabPaymentGroup && (
        <Modal
          title="Registrar pagamento da comanda"
          onClose={closeTableTabPayment}
          footer={(
            <>
              <Button type="button" variant="secondary" onClick={closeTableTabPayment}>Cancelar</Button>
              <Button type="button" onClick={confirmTableTabPayment} disabled={writeDisabled || !onRegisterTableTabPayment}>Confirmar pagamento</Button>
            </>
          )}
        >
          <div className="table-tab-payment-summary">
            <div>
              <span>Comanda</span>
              <strong>{tableTabPaymentGroup.label}</strong>
            </div>
            <div>
              <span>Pedidos pendentes</span>
              <strong>{tableTabPaymentGroup.orders.length}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{currency(tableTabPaymentGroup.total)}</strong>
            </div>
          </div>
          <p className="table-tab-payment-note">Todos os pedidos pendentes desta comanda serão quitados juntos.</p>
          <label className="form-field">
            <span>Forma de pagamento</span>
            <SystemSelect
              label="Forma de pagamento da comanda"
              value={tableTabPaymentMethod}
              options={PAYMENT_METHOD_OPTIONS}
              onChange={setTableTabPaymentMethod}
              disabled={writeDisabled}
            />
          </label>
        </Modal>
      )}
    </>
  )
}

export default Receivables