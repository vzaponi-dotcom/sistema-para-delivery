import { useState } from 'react'
import Button from '../components/Button'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import AreaNavigation from '../components/AreaNavigation'
import RegisterRefundDialog from '../components/RegisterRefundDialog'
import StatCard from '../components/StatCard'
import { formatCancellationDate } from '../utils/orderWorkflow.js'
import { formatOrderDisplayNumber } from '../../shared/orderDisplayNumber.js'

function Finance({ totals, movements, currency, onAddMovement, pendingRefundOrders = [], onRegisterRefund, granted, implemented, onNavigate, activeTab, canManageMovements = true, canRefundPayments = true }) {
  const [refundOrder, setRefundOrder] = useState(null)
  const [refundSubmitting, setRefundSubmitting] = useState(false)
  const writeDisabled = typeof navigator !== 'undefined' && !navigator.onLine

  const confirmRefund = async (payload) => {
    if (!canRefundPayments || !refundOrder || refundSubmitting || !onRegisterRefund) return false
    setRefundSubmitting(true)
    try {
      const saved = await onRegisterRefund(refundOrder.id, payload)
      if (saved !== false) setRefundOrder(null)
    } finally {
      setRefundSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader eyebrow="Financeiro" title="Fluxo de caixa" description="Visualize entradas, saídas e saldo. Pagamentos de pedidos entram automaticamente quando forem confirmados em A Receber." actions={canManageMovements ? <Button icon="plus" onClick={() => { if (canManageMovements) onAddMovement?.() }} disabled={writeDisabled}>Novo movimento</Button> : null} />
      <AreaNavigation area="finance" activeTab={activeTab} granted={granted} implemented={implemented} onNavigate={onNavigate} />
      <section className="stats-grid stats-grid-three" aria-label="Resumo financeiro">
        <StatCard label="Entradas" value={currency(totals.entries)} helper="Receita registrada" icon="arrow-up" tone="success" />
        <StatCard label="Saídas" value={currency(totals.exits)} helper="Despesas registradas" icon="arrow-down" tone="danger" />
        <StatCard label="Saldo" value={currency(totals.balance)} helper="Entradas menos saídas" icon="wallet" tone={totals.balance >= 0 ? 'neutral' : 'danger'} />
      </section>
      {pendingRefundOrders.length > 0 && (
        <section className="surface-card pending-refunds-surface">
          <div className="section-heading"><div><span className="section-kicker">Atenção</span><h2>Estornos pendentes</h2></div><span className="toolbar-count">{pendingRefundOrders.length} pendente(s)</span></div>
          <div className="pending-refund-list">
            {pendingRefundOrders.map((order) => (
              <article className="pending-refund-row" key={order.id}>
                <div className="pending-refund-main"><strong>{formatOrderDisplayNumber(order)} · {order.client}</strong><span>Cancelado em {formatCancellationDate(order.cancelledAt)}</span></div>
                <strong className="pending-refund-value">{currency(order.paidAmount || order.total || 0)}</strong>
                {canRefundPayments && <Button type="button" variant="secondary" className="button-danger-outline" onClick={() => { if (canRefundPayments) setRefundOrder(order) }} disabled={writeDisabled || refundSubmitting}>Registrar estorno</Button>}
              </article>
            ))}
          </div>
        </section>
      )}
      <section className="surface-card">
        <div className="section-heading"><div><span className="section-kicker">Histórico</span><h2>Movimentações</h2></div><span className="toolbar-count">{movements.length} registro(s)</span></div>
        <div className="movement-list">
          {movements.map((movement) => (
            <article className="movement-row" key={movement.id}>
              <div className={movement.type === 'entrada' ? 'movement-icon incoming' : 'movement-icon outgoing'}><Icon name={movement.type === 'entrada' ? 'arrow-up' : 'arrow-down'} size={18} /></div>
              <div className="movement-main"><div className="movement-title-line"><strong>{movement.description}</strong><span className={movement.type === 'entrada' ? 'movement-tag incoming' : 'movement-tag outgoing'}>{movement.type === 'entrada' ? 'Entrada' : 'Saída'}</span>{movement.source === 'order-payment' && <span className="movement-tag incoming">Pedido recebido</span>}{movement.source === 'order-refund' && <span className="movement-tag outgoing">Estorno de pedido</span>}</div><span>{movement.category} · {movement.date}{movement.paymentMethod ? ` · ${movement.paymentMethod}` : ''}</span></div>
              <strong className={movement.type === 'entrada' ? 'movement-value positive' : 'movement-value negative'}>{movement.type === 'entrada' ? '+' : '-'}{currency(movement.value)}</strong>
            </article>
          ))}
        </div>
        {!movements.length && <div className="empty-state"><Icon name="finance" size={28} /><strong>Nenhuma movimentação registrada</strong><span>Registre uma entrada ou saída para começar o controle.</span></div>}
      </section>
      <RegisterRefundDialog open={canRefundPayments && Boolean(refundOrder)} order={refundOrder} onClose={() => setRefundOrder(null)} onConfirm={confirmRefund} submitting={refundSubmitting} />
    </>
  )
}

export default Finance
