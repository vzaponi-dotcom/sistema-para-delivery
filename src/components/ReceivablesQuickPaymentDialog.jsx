import { useMemo, useState } from 'react'
import Icon from './Icon'
import Modal from './Modal'
import { getOrderItemsSearchText, getOrderItemsSummary } from '../utils/orderCart.js'
import { formatOrderDate } from '../utils/orderWorkflow.js'

const orderNumber = (id) => String(id || '').slice(-4)

function ReceivablesQuickPaymentDialog({
  open,
  entries = [],
  currency,
  disabled = false,
  onClose,
  onSelect,
}) {
  const [search, setSearch] = useState('')
  const normalizedSearch = search.trim().toLowerCase()

  const visibleEntries = useMemo(() => entries.filter((entry) => {
    const order = entry.order
    if (!order) return false
    if (!normalizedSearch) return true
    const searchText = [
      entry.label,
      order.client,
      String(order.id),
      order.type,
      order.orderDate,
      getOrderItemsSearchText(order),
    ].join(' ').toLowerCase()
    return searchText.includes(normalizedSearch)
  }), [entries, normalizedSearch])

  if (!open) return null

  const selectEntry = (entry) => {
    if (disabled || !entry?.order?.id || !onSelect) return
    onClose?.()
    onSelect(entry.order.id)
  }

  return (
    <Modal title="Registrar recebimento" onClose={onClose}>
      <div className="receivables-quick-payment">
        <label className="search-control receivables-quick-payment-search">
          <Icon name="search" size={18} />
          <input
            type="search"
            placeholder="Buscar cliente, pedido ou produto"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoFocus
          />
        </label>

        <p className="receivables-quick-payment-helper">
          Selecione um pedido pendente. A forma de pagamento será escolhida na próxima etapa.
        </p>

        <div className="receivables-quick-payment-list" aria-label="Pedidos disponíveis para recebimento">
          {visibleEntries.map((entry) => (
            <button
              type="button"
              className="receivables-quick-payment-row"
              key={entry.key}
              onClick={() => selectEntry(entry)}
              disabled={disabled || !onSelect}
            >
              <span className="receivables-quick-payment-main">
                <strong>{entry.label || 'Pedido sem identificação'}</strong>
                <span>Pedido #{orderNumber(entry.order.id)} · {getOrderItemsSummary(entry.order)}</span>
                <small>{entry.expectedDate ? `Pagamento esperado em ${formatOrderDate(entry.expectedDate)}` : 'Pagamento pendente'}</small>
              </span>
              <strong className="receivables-quick-payment-amount">{currency(entry.total)}</strong>
              <Icon name="details" size={18} />
            </button>
          ))}

          {!visibleEntries.length && (
            <div className="empty-state receivables-quick-payment-empty">
              <Icon name="wallet" size={26} />
              <strong>{entries.length ? 'Nenhum pedido encontrado' : 'Nenhum pedido disponível'}</strong>
              <span>{entries.length ? 'Ajuste a busca para localizar outro pedido.' : 'As comandas continuam sendo recebidas pela ação própria de pagamento agregado.'}</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default ReceivablesQuickPaymentDialog
