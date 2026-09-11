import Button from './Button'

function ComandaDetail({ detail, currency, disabled = false, busyAction = false, printingDisabled = false, onAddOrder, onViewTicket, onPrint, onPay, labelledBy }) {
  const closed = detail.status !== 'open'
  const blocked = disabled || busyAction || closed
  const payable = detail.orderCount > 0 && detail.totalCents > 0
  return (
    <section className="comanda-detail" aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : `Comanda ${detail.number}`}>
      {!labelledBy && <h2>Comanda {detail.number}</h2>}
      <div className="comanda-table-heading"><strong>{detail.table.name}</strong><span>{closed ? 'Encerrada' : 'Ocupada'}</span></div>
      <time dateTime={detail.openedAt}>Abertura: {new Date(detail.openedAt).toLocaleString('pt-BR')}</time>
      <p>{detail.orderCount} {detail.orderCount === 1 ? 'pedido' : 'pedidos'} · {detail.itemCount} {detail.itemCount === 1 ? 'item' : 'itens'}</p>
      <ul className="comanda-detail-items">
        {detail.items.map((item, index) => (
          <li key={index}>
            <strong>{item.quantity}x {item.name}</strong>
            {item.presentation && <span>{item.presentation}</span>}
            {item.note && <span>Obs: {item.note}</span>}
            <span>Unitário: {currency(item.unitPriceCents / 100)}</span>
            <strong>{currency(item.lineTotalCents / 100)}</strong>
          </li>
        ))}
      </ul>
      {!detail.items.length && <p role="status">Nenhum item pendente nesta comanda.</p>}
      <div className="comanda-summary"><span>Total a pagar</span><strong>{currency(detail.totalCents / 100)}</strong></div>
      {disabled && <p role="status">Somente consulta. As alterações estão indisponíveis.</p>}
      <div className="comanda-detail-actions">
        <Button type="button" disabled={blocked} onClick={() => { if (!blocked) onAddOrder?.() }}>Adicionar pedido</Button>
        <Button type="button" variant="secondary" disabled={blocked || printingDisabled} onClick={() => { if (!blocked && !printingDisabled) onViewTicket?.() }}>Ver ticket</Button>
        <Button type="button" variant="secondary" disabled={blocked || printingDisabled} onClick={() => { if (!blocked && !printingDisabled) onPrint?.() }}>Imprimir comanda</Button>
        <Button type="button" disabled={blocked || !payable} onClick={() => { if (!blocked && payable) onPay?.() }}>Registrar pagamento</Button>
      </div>
    </section>
  )
}

export default ComandaDetail
