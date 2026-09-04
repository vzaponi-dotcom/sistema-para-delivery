import { useMemo, useState } from 'react'
import { getBusinessDate, getMovementCategoryLabel, normalizeMovementCategory } from '../../shared/finance.js'
import BottomSheet from '../components/BottomSheet'
import Button from '../components/Button'
import ConfirmationDialog from '../components/ConfirmationDialog'
import FinanceHistoryFilters from '../components/FinanceHistoryFilters'
import FinancePeriodSelector from '../components/FinancePeriodSelector'
import Icon from '../components/Icon'
import MovementDialog from '../components/MovementDialog'
import OpeningBalanceDialog from '../components/OpeningBalanceDialog'
import OrderDetail from '../components/OrderDetail'
import PageHeader from '../components/PageHeader'
import RegisterRefundDialog from '../components/RegisterRefundDialog'
import StatCard from '../components/StatCard'
import {
  calculateCurrentBalance,
  filterFinanceHistory,
  filterMovementsByPeriod,
  getFinancePeriodRange,
  hasFinanceSecondaryFilters,
  summarizeFinancePeriod,
} from '../utils/finance.js'
import { formatCancellationDate } from '../utils/orderWorkflow.js'

const EMPTY_FILTERS = { search: '', type: '', category: '', paymentMethod: '' }

const formatFinanceDate = (value) => {
  if (!value) return 'Não informado'
  const [year, month, day] = String(value).split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

function Finance({
  movements,
  financeSettings = null,
  currency,
  orders = [],
  onCreateMovement,
  onUpdateMovement,
  onDeleteMovement,
  onSaveFinanceSettings,
  actionKey = null,
  pendingRefundOrders = [],
  onRegisterRefund,
}) {
  const [period, setPeriod] = useState({ key: 'today' })
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [editingMovement, setEditingMovement] = useState(undefined)
  const [deletingMovement, setDeletingMovement] = useState(null)
  const [openingDialogOpen, setOpeningDialogOpen] = useState(false)
  const [orderDetailId, setOrderDetailId] = useState(null)
  const [refundOrder, setRefundOrder] = useState(null)
  const [refundSubmitting, setRefundSubmitting] = useState(false)
  const today = getBusinessDate()
  const periodRange = getFinancePeriodRange(period, today)
  const periodMovements = filterMovementsByPeriod(movements, periodRange)
  const summary = summarizeFinancePeriod(movements, periodRange)
  const currentBalance = calculateCurrentBalance(movements, financeSettings)
  const filteredMovements = filterFinanceHistory(periodMovements, filters)
  const movementDialogOpen = editingMovement !== undefined
  const writeDisabled = (typeof navigator !== 'undefined' && !navigator.onLine) || Boolean(actionKey)
  const secondaryFiltersActive = hasFinanceSecondaryFilters(filters)
  const selectedOrder = orders.find((order) => order.id === orderDetailId) ?? null

  const categoryOptions = useMemo(() => {
    const labels = new Map()
    movements.forEach((movement) => {
      const code = normalizeMovementCategory(movement)
      if (code) labels.set(code, getMovementCategoryLabel(movement))
    })
    return [...labels.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'))
  }, [movements])

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
        description="Acompanhe o resultado por período, o saldo atual e o histórico completo das movimentações."
        actions={<Button icon="plus" onClick={() => setEditingMovement(null)} disabled={writeDisabled}>Novo movimento</Button>}
      />

      <div className="finance-period-surface surface-card">
        <div className="finance-block-heading">
          <div>
            <span className="section-kicker">Período</span>
            <strong>Resumo do fluxo</strong>
          </div>
          <span className="finance-period-caption">Movimentos de {formatFinanceDate(periodRange.startDate)} até {formatFinanceDate(periodRange.endDate)}</span>
        </div>
        <FinancePeriodSelector value={period} today={today} onChange={setPeriod} />
      </div>

      <section className="stats-grid finance-stats-grid" aria-label="Resumo financeiro">
        <StatCard label="Entradas" value={currency(summary.entries)} helper="Receitas no período" icon="arrow-up" tone="success" />
        <StatCard label="Saídas" value={currency(summary.exits)} helper="Despesas no período" icon="arrow-down" tone="danger" />
        <StatCard label="Resultado" value={currency(summary.result)} helper="Entradas menos saídas" icon="finance" tone={summary.result >= 0 ? 'success' : 'danger'} />
        <StatCard
          label="Saldo atual"
          value={currentBalance === null ? 'Configure o saldo inicial' : currency(currentBalance)}
          helper={financeSettings ? `Desde ${formatFinanceDate(financeSettings.openingDate)}` : 'O saldo atual depende de uma abertura configurada.'}
          icon="wallet"
          tone={currentBalance === null || currentBalance >= 0 ? 'neutral' : 'danger'}
          action={(
            <Button type="button" variant="ghost" className="finance-balance-button" onClick={() => setOpeningDialogOpen(true)} disabled={writeDisabled}>
              {financeSettings ? 'Editar saldo inicial' : 'Configurar saldo inicial'}
            </Button>
          )}
        />
      </section>

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

      <section className="surface-card finance-history-surface">
        <div className="section-heading finance-history-heading">
          <div><span className="section-kicker">Histórico</span><h2>Movimentações</h2></div>
          <span className="toolbar-count">
            {secondaryFiltersActive ? `${filteredMovements.length} de ${periodMovements.length} no período` : `${periodMovements.length} registro(s) no período`}
          </span>
        </div>

        <div className="finance-filters-desktop">
          <FinanceHistoryFilters value={filters} categoryOptions={categoryOptions} onChange={setFilters} />
        </div>
        <div className="finance-filters-mobile">
          <FinanceHistoryFilters value={filters} categoryOptions={categoryOptions} onChange={setFilters} showSecondary={false} />
          <Button
            type="button"
            variant="secondary"
            className="finance-filter-trigger"
            aria-expanded={filterSheetOpen}
            aria-haspopup="dialog"
            onClick={() => setFilterSheetOpen(true)}
          >
            Filtrar movimentações{secondaryFiltersActive ? ' · filtros ativos' : ''}
          </Button>
        </div>

        <div className="movement-list finance-movement-list">
          {filteredMovements.map((movement) => (
            <article className="movement-row finance-movement-row" key={movement.id}>
              <div className={movement.type === 'entrada' ? 'movement-icon incoming' : 'movement-icon outgoing'}><Icon name={movement.type === 'entrada' ? 'arrow-up' : 'arrow-down'} size={18} /></div>
              <div className="movement-main">
                <div className="movement-title-line">
                  <strong>{movement.description}</strong>
                  <span className={movement.type === 'entrada' ? 'movement-tag incoming' : 'movement-tag outgoing'}>{movement.type === 'entrada' ? 'Entrada' : 'Saída'}</span>
                  {movement.source === 'order-payment' && <span className="movement-tag incoming">Pedido recebido</span>}
                  {movement.source === 'order-refund' && <span className="movement-tag outgoing">Estorno de pedido</span>}
                </div>
                <span>{getMovementCategoryLabel(movement)} · {formatFinanceDate(movement.movementDate || movement.date)} · {movement.paymentMethod || 'Não informado'}</span>
              </div>
              <strong className={movement.type === 'entrada' ? 'movement-value positive' : 'movement-value negative'}>{movement.type === 'entrada' ? '+' : '-'}{currency(movement.value)}</strong>
              <div className="movement-actions finance-movement-actions">
                {movement.source === 'manual' && (
                  <>
                    <Button type="button" variant="secondary" onClick={() => setEditingMovement(movement)} disabled={writeDisabled}>Editar</Button>
                    <Button type="button" variant="secondary" className="button-danger-outline" onClick={() => setDeletingMovement(movement)} disabled={writeDisabled}>Excluir</Button>
                  </>
                )}
                {movement.orderId && movement.source !== 'manual' && (
                  <Button type="button" variant="ghost" onClick={() => setOrderDetailId(movement.orderId)}>Ver pedido</Button>
                )}
              </div>
            </article>
          ))}
        </div>
        {!filteredMovements.length && <div className="empty-state"><Icon name="finance" size={28} /><strong>Nenhuma movimentação encontrada</strong><span>Ajuste o período ou os filtros para consultar outros registros.</span></div>}
      </section>

      <BottomSheet open={filterSheetOpen} title="Filtrar movimentações" onClose={() => setFilterSheetOpen(false)}>
        <div className="finance-filter-sheet-content">
          <FinanceHistoryFilters value={filters} categoryOptions={categoryOptions} onChange={setFilters} showSearch={false} />
          <Button type="button" onClick={() => setFilterSheetOpen(false)}>Aplicar filtros</Button>
        </div>
      </BottomSheet>

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

      <OrderDetail order={selectedOrder} currency={currency} onClose={() => setOrderDetailId(null)} />
      <RegisterRefundDialog open={Boolean(refundOrder)} order={refundOrder} onClose={() => setRefundOrder(null)} onConfirm={confirmRefund} submitting={refundSubmitting} />
    </>
  )
}

export default Finance
