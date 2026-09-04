import { useState } from 'react'
import { getBusinessDate } from '../../shared/finance.js'
import Button from '../components/Button'
import ConfirmationDialog from '../components/ConfirmationDialog'
import Icon from '../components/Icon'
import MovementDialog from '../components/MovementDialog'
import OpeningBalanceDialog from '../components/OpeningBalanceDialog'
import PageHeader from '../components/PageHeader'
import RegisterRefundDialog from '../components/RegisterRefundDialog'
import StatCard from '../components/StatCard'
import { formatCancellationDate } from '../utils/orderWorkflow.js'

function Finance({
  totals,
  movements,
  financeSettings = null,
  currentBalance = null,
  currency,
  onCreateMovement,
  onUpdateMovement,
  onDeleteMovement,
  onSaveFinanceSettings,
  actionKey = null,
  pendingRefundOrders = [],
  onRegisterRefund,
}) {
  const [editingMovement, setEditingMovement] = useState(undefined)
  const [deletingMovement, setDeletingMovement] = useState(null)
  const [openingDialogOpen, setOpeningDialogOpen] = useState(false)
  const [refundOrder, setRefundOrder] = useState(null)
  const [refundSubmitting, setRefundSubmitting] = useState(false)
  const today = getBusinessDate()
  const movementDialogOpen = editingMovement !== undefined
  const writeDisabled = (typeof navigator !== 'undefined' && !navigator.onLine) || Boolean(actionKey)

  const confirmDeleteMovement = async () => {
    if (!deletingMovement || writeDisabled || !onDeleteMovement) return
    const saved = await onDeleteMovement(deletingMovement.id)
    if (saved !== false) setDeletingMovement(null)
  }

  const confirmRefund = async (payload) => {
    if (!refundOrder || refundSubmitting || !onRegisterRefund) return
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
      <PageHeader
        eyebrow="Financeiro"
        title="Fluxo de caixa"
        description="Visualize entradas, saídas e saldo. Pagamentos de pedidos entram automaticamente quando forem confirmados em A Receber."
        actions={<Button icon="plus" onClick={() => setEditingMovement(null)} disabled={writeDisabled}>Novo movimento</Button>}
      />

      <section className="stats-grid stats-grid-three" aria-label="Resumo financeiro">
        <StatCard label="Entradas" value={currency(totals.entries)} helper="Receita registrada" icon="arrow-up" tone="success" />
        <StatCard label="Saídas" value={currency(totals.exits)} helper="Despesas registradas" icon="arrow-down" tone="danger" />
        <StatCard label="Saldo" value={currency(totals.balance)} helper="Entradas menos saídas" icon="wallet" tone={totals.balance >= 0 ? 'neutral' : 'danger'} />
      </section>

      <div className="finance-opening-actions">
        <Button type="button" variant="secondary" onClick={() => setOpeningDialogOpen(true)} disabled={writeDisabled}>
          {financeSettings ? 'Editar saldo inicial' : 'Configurar saldo inicial'}
        </Button>
      </div>

      {pendingRefundOrders.length > 0 && (
        <section className="surface-card pending-refunds-surface">
          <div className="section-heading"><div><span className="section-kicker">Atenção</span><h2>Estornos pendentes</h2></div><span className="toolbar-count">{pendingRefundOrders.length} pendente(s)</span></div>
          <div className="pending-refund-list">
            {pendingRefundOrders.map((order) => (
              <article className="pending-refund-row" key={order.id}>
                <div className="pending-refund-main"><strong>Pedido #{String(order.id).slice(-4)} · {order.client}</strong><span>Cancelado em {formatCancellationDate(order.cancelledAt)}</span></div>
                <strong className="pending-refund-value">{currency(order.paidAmount || order.total || 0)}</strong>
                <Button type="button" variant="secondary" className="button-danger-outline" onClick={() => setRefundOrder(order)} disabled={writeDisabled || refundSubmitting}>Registrar estorno</Button>
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
              <div className="movement-main">
                <div className="movement-title-line">
                  <strong>{movement.description}</strong>
                  <span className={movement.type === 'entrada' ? 'movement-tag incoming' : 'movement-tag outgoing'}>{movement.type === 'entrada' ? 'Entrada' : 'Saída'}</span>
                  {movement.source === 'order-payment' && <span className="movement-tag incoming">Pedido recebido</span>}
                  {movement.source === 'order-refund' && <span className="movement-tag outgoing">Estorno de pedido</span>}
                </div>
                <span>{movement.category} · {movement.movementDate || movement.date}{movement.paymentMethod ? ` · ${movement.paymentMethod}` : ''}</span>
              </div>
              <strong className={movement.type === 'entrada' ? 'movement-value positive' : 'movement-value negative'}>{movement.type === 'entrada' ? '+' : '-'}{currency(movement.value)}</strong>
              {movement.source === 'manual' && (
                <div className="movement-actions">
                  <Button type="button" variant="secondary" onClick={() => setEditingMovement(movement)} disabled={writeDisabled}>Editar</Button>
                  <Button type="button" variant="secondary" className="button-danger-outline" onClick={() => setDeletingMovement(movement)} disabled={writeDisabled}>Excluir</Button>
                </div>
              )}
            </article>
          ))}
        </div>
        {!movements.length && <div className="empty-state"><Icon name="finance" size={28} /><strong>Nenhuma movimentação registrada</strong><span>Registre uma entrada ou saída para começar o controle.</span></div>}
      </section>

      <MovementDialog
        open={movementDialogOpen}
        movement={editingMovement}
        today={today}
        disabled={writeDisabled}
        onClose={() => setEditingMovement(undefined)}
        onSubmit={editingMovement ? (payload) => onUpdateMovement?.(editingMovement.id, payload) : onCreateMovement}
      />

      {deletingMovement && (
        <ConfirmationDialog
          title="Excluir movimentação"
          message="Esta movimentação manual deixará de compor o fluxo de caixa."
          details={(
            <div className="form-stack compact-stack">
              <strong>{deletingMovement.description}</strong>
              <span>{currency(deletingMovement.value)} · {deletingMovement.movementDate || deletingMovement.date}</span>
            </div>
          )}
          confirmLabel="Excluir movimentação"
          confirmVariant="danger"
          onConfirm={confirmDeleteMovement}
          onClose={() => setDeletingMovement(null)}
          disabled={writeDisabled}
        />
      )}

      <OpeningBalanceDialog
        open={openingDialogOpen}
        settings={financeSettings}
        today={today}
        currentBalance={currentBalance}
        disabled={writeDisabled}
        onClose={() => setOpeningDialogOpen(false)}
        onSubmit={onSaveFinanceSettings}
      />

      <RegisterRefundDialog open={Boolean(refundOrder)} order={refundOrder} onClose={() => setRefundOrder(null)} onConfirm={confirmRefund} submitting={refundSubmitting} />
    </>
  )
}

export default Finance
