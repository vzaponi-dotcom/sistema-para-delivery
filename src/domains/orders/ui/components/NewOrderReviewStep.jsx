import Button from '../../../../shared/ui/Button'
import OrderCart from './OrderCart'
import OrderCheckoutSummary from './OrderCheckoutSummary'
import { FINANCE_TIME_ZONE } from '../../../../../shared/finance.js'

function NewOrderReviewStep({ customerSummary, itemCount, cartProps, checkoutProps, disabled, canAdjustOrders = true, onBack }) {
  const scheduledFor = checkoutProps?.draft?.scheduledFor
  const scheduledLabel = scheduledFor
    ? new Intl.DateTimeFormat('pt-BR', {
        timeZone: FINANCE_TIME_ZONE,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(scheduledFor))
    : null
  const scheduleKind = checkoutProps?.draft?.type === 'Local' ? 'Reserva' : 'Agendado'
  return (
    <section className="new-order-step new-order-review-step">
      <div className="new-order-review-context">
        <div><span>Cliente</span><strong>{customerSummary}</strong></div>
        <div><span>Pedido</span><strong>{itemCount} item(ns)</strong></div>
        {scheduledLabel && <div><span>{checkoutProps?.draft?.type === 'Local' ? 'Atendimento' : 'Preparo'}</span><strong>{scheduleKind} · {scheduledLabel}</strong></div>}
      </div>
      <div className="new-order-review-layout">
        <div className="new-order-review-cart">
          <OrderCart {...cartProps} />
          <Button type="button" variant="secondary" onClick={onBack} disabled={disabled}>← Voltar aos produtos</Button>
        </div>
        <OrderCheckoutSummary {...checkoutProps} canAdjustOrders={canAdjustOrders} />
      </div>
    </section>
  )
}

export default NewOrderReviewStep
