import { formatPrintMoneyCents } from '../../../../shared/orderPrintDocument.js'

const clean = (value) => String(value ?? '').trim()

function TableTabTicketPreview({ document }) {
  if (!document || document.type !== 'table-tab') return null

  return (
    <div className="order-ticket-preview" aria-label={`Visualização da comanda ${document.tableTab?.number || ''}`}>
      <header className="order-ticket-preview-header">
        <strong>{document.business?.name || 'Amor & Sabor'}</strong>
        <h3>{`PRÉ-CONTA · COMANDA #${document.tableTab?.number || ''}`}</h3>
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
                {Number.isFinite(Number(item.unitPriceCents)) && <span>Unit. {formatPrintMoneyCents(item.unitPriceCents)}</span>}
                {item.note && <span>Obs: {item.note}</span>}
              </div>
              <span>{formatPrintMoneyCents(item.lineTotalCents || 0)}</span>
            </div>
          )
        })}
      </section>

      <div className="order-ticket-total"><span>TOTAL</span><strong>{formatPrintMoneyCents(document.financial?.totalCents || 0)}</strong></div>
      {document.message && <footer className="order-ticket-message">{document.message}</footer>}
    </div>
  )
}

export default TableTabTicketPreview
