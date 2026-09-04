import Button from './Button'

function NewOrderCartSummary({ items, itemCount, subtotal, currency, disabled, onReview }) {
  return (
    <aside className="surface-card new-order-cart-summary" aria-label="Resumo do carrinho">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Seu pedido</span>
          <h2>Resumo</h2>
        </div>
        <span className="toolbar-count">{itemCount} item(ns)</span>
      </div>

      <div className="new-order-cart-summary-lines">
        {items.map((item) => (
          <div key={item.lineId} className="new-order-cart-summary-line">
            <span>{item.quantity}× {item.name}</span>
            <strong>{currency(Number(item.unitPrice || 0) * Number(item.quantity || 0))}</strong>
          </div>
        ))}
        {!items.length && <span className="new-order-cart-summary-empty">Nenhum produto adicionado.</span>}
      </div>

      <div className="new-order-cart-summary-total">
        <span>Subtotal dos produtos</span>
        <strong>{currency(subtotal)}</strong>
      </div>

      <Button type="button" onClick={onReview} disabled={disabled || !itemCount}>Revisar pedido</Button>
    </aside>
  )
}

export default NewOrderCartSummary
