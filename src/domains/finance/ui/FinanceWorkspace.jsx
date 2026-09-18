import { useMemo } from 'react'
import { calculateCurrentBalance } from '../domain/cashFlow.js'
import { useFinanceCommands } from '../application/useFinanceCommands.js'
import Finance from './Finance.jsx'
import MovementDialog from './MovementDialog.jsx'
import OpeningBalanceDialog from './OpeningBalanceDialog.jsx'

export default function FinanceWorkspace({
  movements = [],
  financeSettings = null,
  today,
  currency,
  pendingRefundOrders = [],
  paymentOptions = [],
  categoryOptions = [],
  categoryRevision = null,
  writesBlocked = false,
  canManageMovements = true,
  canRefundPayments = true,
  applyOfficialEffects,
  setRequestKey,
  onSuccess,
  onError,
  formatCancellationDate,
  onRequestRefund,
}) {
  const totals = useMemo(() => {
    const entries = movements
      .filter((movement) => movement.type === 'entrada')
      .reduce((total, movement) => total + Number(movement.value), 0)
    const exits = movements
      .filter((movement) => movement.type === 'saida')
      .reduce((total, movement) => total + Number(movement.value), 0)
    return { entries, exits, balance: entries - exits }
  }, [movements])
  const currentBalance = useMemo(
    () => calculateCurrentBalance(movements, financeSettings),
    [financeSettings, movements],
  )
  const commands = useFinanceCommands({
    applyOfficialEffects,
    writesBlocked,
    canManageMovements,
    setRequestKey,
    onSuccess,
    onError,
  })

  return (
    <>
      <Finance
        totals={totals}
        movements={movements}
        currency={currency}
        onAddMovement={commands.openNewMovement}
        onEditMovement={commands.openEditMovement}
        onDeleteMovement={commands.deleteMovement}
        pendingRefundOrders={pendingRefundOrders}
        onRequestRefund={onRequestRefund}
        formatCancellationDate={formatCancellationDate}
        canManageMovements={canManageMovements}
        canRefundPayments={canRefundPayments}
      />
      <MovementDialog
        open={canManageMovements && commands.movementDialog.open}
        movement={commands.movementDialog.movement}
        today={today}
        disabled={writesBlocked}
        paymentOptions={paymentOptions}
        categoryOptions={categoryOptions}
        categoryRevision={categoryRevision}
        onClose={commands.closeMovementDialog}
        onSubmit={commands.saveMovement}
      />
      <OpeningBalanceDialog
        open={canManageMovements && commands.openingBalanceOpen}
        settings={financeSettings}
        today={today}
        currentBalance={currentBalance}
        disabled={writesBlocked}
        onClose={commands.closeOpeningBalance}
        onSubmit={commands.saveOpeningBalance}
      />
    </>
  )
}
