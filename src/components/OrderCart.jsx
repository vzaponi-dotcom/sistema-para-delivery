import Button from './Button'

function OrderCart({ items, currency, disabled = false, onUpdate, onRemove }) {
  return (
    <section className="surface-card new-order-cart">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Pedido</span>
          <h2>Carrinho</h2>
        </div>
        <span className="toolbar-count">{items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)} item(ns)</span>
      </div>

      <div className="new-order-cart-lines">
        {items.map((item) => (
          <article className="new-order-cart-line" key={item.lineId}>
            <div className="new-order-cart-line-heading">
              <div>
                <strong>{item.name}</strong>
                <span>{[item.category, item.size].filter(Boolean).join(' · ')}</span>
              </div>
              <strong>{currency(Number(item.unitPrice || 0) * Number(item.quantity || 1))}</strong>
            </div>

            <div className="new-order-quantity-row">
              <div className="new-order-quantity-control" aria-label={`Quantidade de ${item.name}`}>
                <button type="button" onClick={() => onUpdate(item.lineId, { quantity: Number(item.quantity || 1) - 1 })} disabled={disabled}>−</button>
                <strong>{item.quantity}</strong>
                <button type="button" onClick={() => onUpdate(item.lineId, { quantity: Number(item.quantity || 1) + 1 })} disabled={disabled}>+</button>
              </div>
              <span>{currency(item.unitPrice)} cada</span>
              <Button type="button" variant="secondary" onClick={() => onRemove(item.lineId)} disabled={disabled}>Remover</Button>
            </div>

            <label className="form-field compact-field">
              <span>Observação deste item</span>
              <textarea
                rows="2"
                maxLength={300}
                value={item.note}
                placeholder="Ex: sem cebola"
                onChange={(event) => onUpdate(item.lineId, { note: event.target.value })}
                disabled={disabled}
              />
              <small className="form-hint">{item.note.length}/300 caracteres</small>
            </label>
          </article>
        ))}

        {!items.length && (
          <div className="empty-state compact">
            <strong>O carrinho está vazio</strong>
            <span>Escolha os produtos do pedido para começar a venda.</span>
          </div>
        )}
      </div>
    </section>
  )
}

export default OrderCart
