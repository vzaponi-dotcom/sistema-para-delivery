import Button from '../../../../shared/ui/Button'
import OrderCart from './OrderCart'

function NewOrderCartSummary({ items, itemCount, subtotal, currency, disabled, onReview, cartProps }) {
  return <aside className="surface-card new-order-cart-summary" aria-label="Resumo do carrinho">
    <div className="section-heading"><h2>Seu pedido</h2><span className="toolbar-count">{itemCount} itens</span></div>
    <OrderCart items={items} currency={currency} {...cartProps} disabled={disabled} compact />
    <div className="new-order-summary-footer">
      <div className="new-order-cart-summary-total"><span>Subtotal dos produtos</span><strong>{currency(subtotal)}</strong></div>
      <Button type="button" onClick={onReview} disabled={disabled || !itemCount}>Revisar pedido →</Button>
      <p>Taxas e ajustes na próxima etapa.</p>
    </div>
  </aside>
}
export default NewOrderCartSummary
