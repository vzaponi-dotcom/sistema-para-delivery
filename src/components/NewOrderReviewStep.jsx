import Button from './Button'
import OrderCart from './OrderCart'
import OrderCheckoutSummary from './OrderCheckoutSummary'

function NewOrderReviewStep({ customerSummary, itemCount, cartProps, checkoutProps, disabled, onBack }) {
  const scheduledFor = checkoutProps?.draft?.scheduledFor
  const scheduledLabel = scheduledFor
    ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(scheduledFor))
    : null
  return (
    <section className="new-order-step new-order-review-step">
      <div className="new-order-review-context">
        <div><span>Cliente</span><strong>{customerSummary}</strong></div>
        <div><span>Pedido</span><strong>{itemCount} item(ns)</strong></div>
        {scheduledLabel && <div><span>Preparo</span><strong>Agendado · {scheduledLabel}</strong></div>}
      </div>
      <div className="new-order-review-layout">
        <div className="new-order-review-cart">
          <OrderCart {...cartProps} />
          <Button type="button" variant="secondary" onClick={onBack} disabled={disabled}>← Voltar aos produtos</Button>
        </div>
        <OrderCheckoutSummary {...checkoutProps} />
      </div>
    </section>
  )
}

export default NewOrderReviewStep
