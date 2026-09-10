import { useLayoutEffect, useRef, useState } from 'react'
import '../comandas.css'
import Button from '../components/Button'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'

const defaultCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const itemSummary = (count) => `${count} ${count === 1 ? 'item' : 'itens'}`

function Comandas({ tables = [], selectedTableId, onSelectTable, onAddOrder, currency = defaultCurrency, disabled = false }) {
  const activeTables = tables.filter((table) => table.isActive).sort((left, right) => left.sortOrder - right.sortOrder)
  const selectedTable = activeTables.find((table) => table.id === selectedTableId && table.occupancy === 'occupied') || null
  const [mobileDetailOpen, setMobileDetailOpen] = useState(Boolean(selectedTable))
  const listRef = useRef(null)
  const listScrollRef = useRef(0)
  const selectedButtonRef = useRef(null)
  const detailHeadingRef = useRef(null)
  const wasDetailOpenRef = useRef(false)
  const showMobileDetail = Boolean(selectedTable && mobileDetailOpen)

  useLayoutEffect(() => {
    if (!window.matchMedia?.('(max-width: 820px)').matches) return
    if (showMobileDetail) {
      detailHeadingRef.current?.focus({ preventScroll: true })
    } else if (wasDetailOpenRef.current) {
      if (listRef.current) listRef.current.scrollTop = listScrollRef.current
      selectedButtonRef.current?.focus({ preventScroll: true })
    }
    wasDetailOpenRef.current = showMobileDetail
  }, [showMobileDetail, selectedTableId])

  const selectTable = (table) => {
    if (table.occupancy === 'free') {
      if (!disabled) onAddOrder?.(table.id)
      return
    }
    listScrollRef.current = listRef.current?.scrollTop || 0
    onSelectTable?.(table.id)
    setMobileDetailOpen(true)
  }

  return (
    <div className={`comandas-page${showMobileDetail ? ' has-mobile-detail' : ''}`}>
      <PageHeader title="Comandas" description="Acompanhe mesas e comandas abertas." />
      <div className="comandas-workspace">
        <section className="comandas-list-panel" aria-label="Mesas ativas" ref={listRef} onScroll={(event) => {
          if (!showMobileDetail) listScrollRef.current = event.currentTarget.scrollTop
        }}>
          {activeTables.map((table) => {
            const occupied = table.occupancy === 'occupied'
            const selected = selectedTable?.id === table.id
            const tab = table.openTableTab
            return (
              <button key={table.id} type="button" className="comanda-table-button" aria-pressed={selected} aria-controls={occupied ? 'comandas-detail' : undefined} disabled={!occupied && disabled} ref={selected ? selectedButtonRef : undefined} onClick={() => selectTable(table)}>
                <span className="comanda-table-heading"><strong>{table.name}</strong><span className={`comanda-status ${occupied ? 'occupied' : 'free'}`}>{occupied ? 'Ocupada' : 'Livre'}</span></span>
                {occupied ? (tab ? <><span className="comanda-number">Comanda {tab.number}</span><span className="comanda-summary"><span>{itemSummary(tab.itemCount)}</span><strong>{currency(tab.totalCents / 100)}</strong></span></> : <span>Resumo indisponível</span>) : <span className="comanda-free-hint">Toque para lançar pedido</span>}
              </button>
            )
          })}
          {!activeTables.length && <div className="empty-state" role="status"><Icon name="table" size={28} /><strong>Nenhuma mesa ativa</strong><span>Ative ou cadastre mesas na área Mesas.</span></div>}
        </section>
        <aside id="comandas-detail" className="comandas-detail-panel surface-card" aria-label="Detalhe da comanda">
          {selectedTable ? (
            <>
              <Button type="button" variant="secondary" className="comandas-mobile-back" onClick={() => setMobileDetailOpen(false)}>Voltar para mesas</Button>
              <h2 ref={detailHeadingRef} tabIndex={-1}>{selectedTable.openTableTab ? `Comanda ${selectedTable.openTableTab.number}` : 'Comanda aberta'}</h2>
              <div className="comanda-table-heading"><strong>{selectedTable.name}</strong><span className="comanda-status occupied">Ocupada</span></div>
              {selectedTable.openTableTab ? <div className="comanda-summary"><span>{itemSummary(selectedTable.openTableTab.itemCount)}</span><strong>{currency(selectedTable.openTableTab.totalCents / 100)}</strong></div> : <p>Resumo indisponível</p>}
            </>
          ) : <div className="empty-state"><Icon name="clipboard" size={28} /><strong>Selecione uma mesa ocupada.</strong><span>Confira aqui o resumo da comanda.</span></div>}
        </aside>
      </div>
    </div>
  )
}

export default Comandas
