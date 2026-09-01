import { useEffect, useMemo, useState } from 'react'
import '../order-operations.css'
import Button from '../components/Button'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import StatusBadge from '../components/StatusBadge'
import {
  getElapsedMinutes,
  getFinalActionLabel,
  getOrderUrgency,
  isFinishedToday,
  isOrderFinished,
} from '../utils/orderWorkflow'

const orderNumber = (id) => String(id).slice(-4)

const finishedTime = (order) => {
  if (!order.finishedAt) return order.date || ''

  return new Date(order.finishedAt).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Orders({ orders, search, onSearchChange, currency, onNewOrder, onFinalizeOrder, onDeleteOrder }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const normalizedSearch = search.trim().toLowerCase()

  const visibleOrders = useMemo(() => {
    if (!normalizedSearch) return orders

    return orders.filter((order) =>
      [order.client, order.type, order.size, order.date, order.productName, order.status]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch),
    )
  }, [normalizedSearch, orders])

  const activeOrders = useMemo(
    () =>
      visibleOrders
        .filter((order) => !isOrderFinished(order))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [visibleOrders],
  )

  const finishedOrders = useMemo(
    () =>
      visibleOrders
        .filter(isOrderFinished)
        .sort((a, b) => new Date(b.finishedAt).getTime() - new Date(a.finishedAt).getTime()),
    [visibleOrders],
  )

  const activeCount = orders.filter((order) => !isOrderFinished(order)).length
  const delayedCount = orders.filter(
    (order) => !isOrderFinished(order) && getOrderUrgency(order, now) === 'delayed',
  ).length
  const finishedTodayCount = orders.filter((order) => isFinishedToday(order, now)).length

  return (
    <>
      <PageHeader
        eyebrow="Operação"
        title="Pedidos em preparo"
        description="Acompanhe a fila da cozinha. O tempo e os atrasos são calculados automaticamente; você só finaliza quando o pedido sair da operação."
        actions={<Button icon="plus" onClick={onNewOrder}>Novo pedido</Button>}
      />

      <section className="stats-grid stats-grid-three order-ops-stats" aria-label="Resumo dos pedidos">
        <StatCard label="Em preparo" value={activeCount} helper="Pedidos ativos agora" icon="receipt" />
        <StatCard label="Atrasados" value={delayedCount} helper="25 min ou mais" icon="orders" tone={delayedCount ? 'danger' : 'neutral'} />
        <StatCard label="Finalizados hoje" value={finishedTodayCount} helper="Já saíram da operação" icon="dashboard" tone="success" />
      </section>

      <section className="surface-card order-ops-surface">
        <div className="toolbar">
          <label className="search-control">
            <Icon name="search" size={18} />
            <input
              type="search"
              placeholder="Buscar cliente, produto ou tipo de pedido"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </label>
          <span className="toolbar-count">{activeOrders.length} na fila</span>
        </div>

        <div className="section-heading order-queue-heading">
          <div>
            <span className="section-kicker">Cozinha</span>
            <h2>Fila em preparo</h2>
          </div>
          <span className="order-queue-help">Mais antigos aparecem primeiro</span>
        </div>

        <div className="order-queue">
          {activeOrders.map((order) => {
            const elapsed = getElapsedMinutes(order, now)
            const urgency = getOrderUrgency(order, now)
            const urgencyLabel = urgency === 'delayed' ? 'Atrasado' : urgency === 'attention' ? 'Atenção' : 'Em preparo'

            return (
              <article className={`order-queue-card urgency-${urgency}`} key={order.id}>
                <div className="order-queue-number">#{orderNumber(order.id)}</div>

                <div className="order-queue-main">
                  <div className="order-queue-title">
                    <div>
                      <strong>{order.client}</strong>
                      <span>{order.productName || `Marmita ${order.size}`} · {order.quantity} un.</span>
                    </div>
                    <StatusBadge status="Em preparo" />
                  </div>

                  <div className="order-queue-meta">
                    <span>{order.type}</span>
                    <span>{currency(order.total)}</span>
                    <span className={`order-time urgency-${urgency}`}>
                      {urgencyLabel} · {elapsed < 1 ? 'agora' : `há ${elapsed} min`}
                    </span>
                  </div>
                </div>

                <div className="order-queue-actions">
                  <Button onClick={() => onFinalizeOrder(order.id)}>
                    {getFinalActionLabel(order)}
                  </Button>
                  <button
                    type="button"
                    className="icon-button icon-button-danger"
                    aria-label={`Excluir pedido de ${order.client}`}
                    title="Excluir pedido"
                    onClick={() => onDeleteOrder(order.id)}
                  >
                    <Icon name="trash" size={17} />
                  </button>
                </div>
              </article>
            )
          })}

          {!activeOrders.length && (
            <div className="empty-state compact-empty-state">
              <Icon name="orders" size={28} />
              <strong>{search ? 'Nenhum pedido ativo encontrado' : 'A fila está vazia'}</strong>
              <span>{search ? 'Ajuste sua busca para localizar outros pedidos.' : 'Novos pedidos entram aqui automaticamente em preparo.'}</span>
            </div>
          )}
        </div>
      </section>

      <section className="surface-card order-history-surface">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Histórico</span>
            <h2>Finalizados</h2>
          </div>
          <span className="toolbar-count">{finishedOrders.length} registro(s)</span>
        </div>

        <div className="order-history-list">
          {finishedOrders.slice(0, 10).map((order) => (
            <article className="order-history-row" key={order.id}>
              <div className="order-history-number">#{orderNumber(order.id)}</div>
              <div className="order-history-main">
                <strong>{order.client}</strong>
                <span>{order.productName || `Marmita ${order.size}`} · {order.quantity} un. · {order.type}</span>
              </div>
              <StatusBadge status="Finalizado" />
              <div className="order-history-value">
                <strong>{currency(order.total)}</strong>
                <span>{finishedTime(order)}</span>
              </div>
              <button
                type="button"
                className="icon-button icon-button-danger"
                aria-label={`Excluir pedido finalizado de ${order.client}`}
                title="Excluir pedido"
                onClick={() => onDeleteOrder(order.id)}
              >
                <Icon name="trash" size={16} />
              </button>
            </article>
          ))}

          {!finishedOrders.length && (
            <div className="empty-state compact-empty-state">
              <strong>Nenhum pedido finalizado</strong>
              <span>Os pedidos sairão da fila de preparo e aparecerão aqui após a ação final.</span>
            </div>
          )}
        </div>
      </section>
    </>
  )
}

export default Orders
