import Button from './Button'
import NewOrderCartSummary from './NewOrderCartSummary'
import OrderProductCatalog from './OrderProductCatalog'

function NewOrderProductsStep({
  products,
  items,
  currency,
  disabled,
  customerSummary,
  itemCount,
  subtotal,
  onAdd,
  onDecrease,
  onBack,
  onReview,
}) {
  return (
    <section className="new-order-step new-order-products-step">
      <div className="new-order-step-context" role="status">{customerSummary}</div>
      <div className="new-order-products-layout">
        <OrderProductCatalog
          products={products}
          items={items}
          currency={currency}
          disabled={disabled}
          onAdd={onAdd}
          onDecrease={onDecrease}
        />
        <NewOrderCartSummary
          items={items}
          itemCount={itemCount}
          subtotal={subtotal}
          currency={currency}
          disabled={disabled}
          onReview={onReview}
        />
      </div>
      <div className="new-order-products-navigation">
        <Button type="button" variant="secondary" onClick={onBack} disabled={disabled}>← Voltar</Button>
      </div>
      <button
        type="button"
        className="new-order-mobile-cart-action"
        onClick={onReview}
        disabled={disabled || !itemCount}
      >
        <span>{itemCount} item(ns) · {currency(subtotal)}</span>
        <strong>Ver carrinho →</strong>
      </button>
    </section>
  )
}

export default NewOrderProductsStep
