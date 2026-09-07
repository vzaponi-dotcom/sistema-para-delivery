function LocalTableSelector({ tables, selectedTableId, onSelect, disabled }) {
  const activeTables = tables.filter((table) => table.isActive)
  const selectedTable = activeTables.find((table) => table.id === selectedTableId) ?? null

  return (
    <div className="new-order-table-selector">
      <div className="new-order-table-grid" role="group" aria-label="Mesas disponíveis">
        {activeTables.map((table) => {
          const occupied = table.occupancy === 'occupied'
          const selected = selectedTableId === table.id

          return (
            <button
              key={table.id}
              type="button"
              className={`new-order-table-option${selected ? ' selected' : ''}`}
              aria-pressed={selectedTableId === table.id}
              onClick={() => onSelect(table.id)}
              disabled={disabled}
            >
              <strong>{table.name}</strong>
              <span className={`new-order-table-status ${occupied ? 'occupied' : 'free'}`}>
                {table.occupancy === 'occupied' ? 'Ocupada' : 'Livre'}
              </span>
            </button>
          )
        })}
      </div>

      {!activeTables.length && (
        <p className="new-order-table-empty" role="status">Nenhuma mesa ativa disponível.</p>
      )}

      {selectedTable?.occupancy === 'occupied' && (
        <div className="new-order-table-tab-hint" role="status">
          Comanda aberta — este pedido será adicionado à {selectedTable.name}
        </div>
      )}
    </div>
  )
}

export default LocalTableSelector
