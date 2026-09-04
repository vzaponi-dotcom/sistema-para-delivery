import { formatPrintMoneyCents } from '../../shared/orderPrintDocument.js'

const clean = (value) => String(value ?? '').trim()

function OrderTicketPreview({ document }) {
  if (!document || document.type !== 'order') return null

  const adjustment = document.financial?.adjustment || { type: 'none', amountCents: 0 }
  const adjustmentLabel = adjustment.type === 'discount' ? 'Desconto' : 'Acréscimo'
  const adjustmentSign = adjustment.type === 'discount' ? '−' : '+'

  return (
    <div className="order-ticket-preview" aria-label={`Visualização do pedido ${document.order?.number || ''}`}>
      <header className="order-ticket-preview-header">
        <strong>{document.business?.name || 'Amor & Sabor'}</strong>
        <h3>PEDIDO #{document.order?.number || ''}</h3>
        {document.order?.type && <span>{document.order.type}</span>}
      </header>

      <div className="order-ticket-divider" />
      <section className="order-ticket-block">
        <strong>Cliente</strong>
        <span>{document.customer?.name || 'Não informado'}</span>
        {document.customer?.phone && <span>{document.customer.phone}</span>}
        {document.order?.type === 'Entrega' && document.customer?.address && <span>{document.customer.address}</span>}
      </section>

      <div className="order-ticket-divider" />
      <section className="order-ticket-block">
        <strong>ITENS</strong>
        {(document.items || []).map((item, index) => {
          const presentation = clean(item.presentation)
          return (
            <div className="order-ticket-item" key={`${item.name}-${presentation}-${index}`}>
              <div>
                <strong>{Number(item.quantity) || 1}x {clean(item.name)}{presentation ? ` ${presentation}` : ''}</strong>
                {item.note && <span>Obs: {item.note}</span>}
              </div>
              <span>{formatPrintMoneyCents(item.lineTotalCents || 0)}</span>
            </div>
          )
        })}
      </section>

      <div className="order-ticket-divider" />
      <section className="order-ticket-totals">
        <div><span>Subtotal</span><strong>{formatPrintMoneyCents(document.financial?.subtotalCents || 0)}</strong></div>
        {Number(document.financial?.deliveryFeeCents || 0) > 0 && <div><span>Taxa de entrega</span><strong>{formatPrintMoneyCents(document.financial.deliveryFeeCents)}</strong></div>}
        {adjustment.type !== 'none' && Number(adjustment.amountCents || 0) > 0 && (
          <div><span>{adjustmentLabel}</span><strong>{adjustmentSign} {formatPrintMoneyCents(adjustment.amountCents)}</strong></div>
        )}
        <div className="order-ticket-total"><span>TOTAL</span><strong>{formatPrintMoneyCents(document.financial?.totalCents || 0)}</strong></div>
      </section>

      <div className="order-ticket-divider" />
      <section className="order-ticket-block">
        <strong>Pagamento</strong>
        <span>{document.payment?.status === 'Pago' ? `PAGO${document.payment.method ? ` - ${document.payment.method}` : ''}` : 'PENDENTE'}</span>
      </section>

      {document.message && <footer className="order-ticket-message">{document.message}</footer>}
    </div>
  )
}

export default OrderTicketPreview
