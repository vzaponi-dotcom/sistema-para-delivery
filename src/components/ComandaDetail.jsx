import Button from './Button'
import Icon from './Icon'

function ComandaDetail({ detail, currency, disabled = false, busyAction = false, printingDisabled = false, canTransfer = false, canCreateOrders = true, canExecutePrinting = true, onAddOrder, onViewTicket, onPrint, onPay, onTransfer, labelledBy, headingId = 'comanda-heading', headingRef }) {
  const closed = detail.status !== 'open'
  const blocked = disabled || busyAction || closed
  const payable = detail.orderCount > 0 && detail.totalCents > 0
  const titleId = labelledBy || headingId
  const orderLabel = `${detail.orderCount} ${detail.orderCount === 1 ? 'pedido' : 'pedidos'}`
  const itemLabel = `${detail.itemCount} ${detail.itemCount === 1 ? 'item' : 'itens'}`

  return (
    <section className="comanda-detail" aria-labelledby={titleId}>
      <div className="comanda-detail-hero">
        <div className="comanda-detail-identity">
          <span className="comanda-detail-eyebrow">COMANDA</span>
          <h2 id={titleId} ref={headingRef} tabIndex={headingRef ? -1 : undefined}>
            <span className="comanda-visually-hidden">Comanda </span>
            <span className="comanda-detail-number">{detail.number}</span>
          </h2>
        </div>
        <div className="comanda-detail-hero-info">
          <div className="comanda-detail-hero-chips">
            <span className="comanda-detail-table-chip"><Icon name="table" size={20} /><strong>{detail.table.name}</strong></span>
            <span className={`comanda-detail-status-chip${closed ? ' is-closed' : ''}`}><span className="comanda-detail-status-dot" aria-hidden="true" />{closed ? 'Encerrada' : 'Ocupada'}</span>
          </div>
          <time dateTime={detail.openedAt}><Icon name="clock" size={18} />Abertura: {new Date(detail.openedAt).toLocaleString('pt-BR')}</time>
        </div>
      </div>

      <div className="comanda-detail-order-summary">
        <Icon name="meal" size={22} />
        <strong>{orderLabel} <span aria-hidden="true">•</span> {itemLabel}</strong>
      </div>

      <section className="comanda-detail-items-section" aria-labelledby="comanda-items-heading">
        <header className="comanda-detail-section-heading">
          <span className="comanda-detail-section-title"><Icon name="receipt" size={22} /><strong id="comanda-items-heading">Resumo do pedido</strong></span>
          <span>{itemLabel}</span>
        </header>
        <ul className="comanda-detail-items">
          {detail.items.map((item, index) => (
            <li key={index}>
              <span className="comanda-detail-quantity" aria-label={`Quantidade ${item.quantity}`}>{item.quantity}x</span>{' '}
              <div className="comanda-detail-item-copy">
                <strong>{item.name}</strong>
                {item.presentation && <span className="comanda-detail-presentation">{item.presentation}</span>}
                {item.note && <span className="comanda-detail-note">Obs: {item.note}</span>}
                <span className="comanda-detail-unit-price">Unitário: {currency(item.unitPriceCents / 100)}</span>
              </div>
              <div className="comanda-detail-subtotal">
                <span>Subtotal</span>
                <strong>{currency(item.lineTotalCents / 100)}</strong>
              </div>
            </li>
          ))}
        </ul>
        {!detail.items.length && <p className="comanda-detail-empty" role="status">Nenhum item pendente nesta comanda.</p>}

        <div className="comanda-detail-total">
          <span className="comanda-detail-total-icon"><Icon name="wallet" size={22} /></span>
          <span className="comanda-detail-total-copy"><strong>Total a pagar</strong><small>{itemLabel} · {orderLabel}</small></span>
          <strong className="comanda-detail-total-value">{currency(detail.totalCents / 100)}</strong>
        </div>

        {disabled && <p className="comanda-detail-readonly" role="status">Somente consulta. As alterações estão indisponíveis.</p>}

        <div className="comanda-detail-actions">
          {canCreateOrders && <Button type="button" icon="plus" className="comanda-action-primary" disabled={blocked} onClick={() => { if (canCreateOrders && !blocked) onAddOrder?.() }}>Adicionar pedido</Button>}
          <Button type="button" variant="secondary" icon="finance" className="comanda-action-payment" disabled={blocked || !payable} onClick={() => { if (!blocked && payable) onPay?.() }}>Registrar pagamento</Button>
          <div className="comanda-detail-secondary-actions">
            {canTransfer && <Button type="button" variant="secondary" className="comanda-action-secondary comanda-action-transfer" disabled={blocked} onClick={() => { if (!blocked) onTransfer?.() }}>Transferir comanda</Button>}
            <Button type="button" variant="secondary" icon="ticket" className="comanda-action-secondary" disabled={blocked || printingDisabled} onClick={() => { if (!blocked && !printingDisabled) onViewTicket?.() }}>Ver ticket</Button>
            <Button type="button" variant="secondary" icon="printer" className="comanda-action-secondary" disabled={blocked || printingDisabled || !canExecutePrinting} onClick={() => { if (canExecutePrinting && !blocked && !printingDisabled) onPrint?.() }}>Imprimir comanda</Button>
          </div>
        </div>
      </section>
    </section>
  )
}

export default ComandaDetail
