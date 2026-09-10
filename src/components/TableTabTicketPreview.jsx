import { formatPrintMoneyCents } from '../../shared/orderPrintDocument.js'

const clean = (value) => String(value ?? '').trim()

function TableTabTicketPreview({ document }) {
  if (!document || document.type !== 'table-tab') return null

  return (
    <div className="order-ticket-preview" aria-label={`Visualiza\u00e7\u00e3o da comanda ${document.tableTab?.number || ''}`}>
      <header className="order-ticket-preview-header">
        <strong>{document.business?.name || 'Amor & Sabor'}</strong>
        <h3>{`PR\u00c9-CONTA \u00b7 COMANDA #${document.tableTab?.number || ''}`}</h3>
        {document.tableTab?.tableName && <span>{document.tableTab.tableName}</span>}
      </header>

      <div className="order-ticket-divider" />
      <section className="order-ticket-block">
        <strong>ITENS</strong>
        {(document.items || []).map((item, index) => {
          const presentation = clean(item.presentation)
          return (
            <div className="order-ticket-item" key={`${item.name}-${presentation}-${item.note}-${index}`}>
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
      <div className="order-ticket-total"><span>TOTAL</span><strong>{formatPrintMoneyCents(document.financial?.totalCents || 0)}</strong></div>
      {document.message && <footer className="order-ticket-message">{document.message}</footer>}
    </div>
  )
}

export default TableTabTicketPreview
