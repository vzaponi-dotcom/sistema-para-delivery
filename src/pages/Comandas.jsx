import { useLayoutEffect, useRef, useState } from 'react'
import '../comandas.css'
import Button from '../components/Button'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { useMediaQuery } from '../hooks/useMediaQuery.js'

const defaultCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const itemSummary = (count) => `${count} ${count === 1 ? 'item' : 'itens'}`

function Comandas({ tables = [], selectedTableId, onSelectTable, onAddOrder, currency = defaultCurrency, disabled = false }) {
  const activeTables = tables.filter((table) => table.isActive).sort((left, right) => left.sortOrder - right.sortOrder)
  const selectedTable = activeTables.find((table) => table.id === selectedTableId && table.occupancy === 'occupied') || null
  const [mobileDetailOpen, setMobileDetailOpen] = useState(Boolean(selectedTable))
  // Invalidate the opening intent as well as the visible detail. A later refresh
  // may reuse this table ID, but only another user selection should reopen it.
  if (mobileDetailOpen && !selectedTable) setMobileDetailOpen(false)
  const listRef = useRef(null)
  const listScrollRef = useRef(0)
  const selectedButtonRef = useRef(null)
  const detailHeadingRef = useRef(null)
  const backButtonRef = useRef(null)
  const lastFocusedRef = useRef(null)
  const isMobile = useMediaQuery('(max-width: 820px)')
  const previousLayoutRef = useRef({ isMobile, showMobileDetail: false, selectedTableId: null })
  const showMobileDetail = Boolean(selectedTable && mobileDetailOpen)

  useLayoutEffect(() => {
    const previous = previousLayoutRef.current
    // CSS can blur a newly hidden element before the media-query notification.
    const focused = document.activeElement === document.body ? lastFocusedRef.current : document.activeElement
    if (isMobile && showMobileDetail) {
      const openedDetail = previous.isMobile && (!previous.showMobileDetail || previous.selectedTableId !== selectedTableId)
      const hidFocusedList = !previous.isMobile && listRef.current?.contains(focused)
      if (openedDetail || hidFocusedList) detailHeadingRef.current?.focus({ preventScroll: true })
    } else if (previous.isMobile && previous.showMobileDetail && !showMobileDetail) {
      if (listRef.current) listRef.current.scrollTop = listScrollRef.current
      const selectedButton = selectedButtonRef.current
      const target = selectedButton && !selectedButton.disabled
        ? selectedButton
        : listRef.current?.querySelector('button:not(:disabled)') || listRef.current
      target?.focus({ preventScroll: true })
    } else if (!isMobile && previous.isMobile && focused && focused === backButtonRef.current) {
      detailHeadingRef.current?.focus({ preventScroll: true })
    }
    previousLayoutRef.current = { isMobile, showMobileDetail, selectedTableId }
  }, [isMobile, showMobileDetail, selectedTableId])

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
    <div className={`comandas-page${showMobileDetail ? ' has-mobile-detail' : ''}`} onFocusCapture={(event) => { lastFocusedRef.current = event.target }} onBlurCapture={(event) => {
      if (event.relatedTarget) lastFocusedRef.current = null
    }}>
      <PageHeader title="Comandas" description="Acompanhe mesas e comandas abertas." />
      <div className="comandas-workspace">
        <section className="comandas-list-panel" aria-label="Mesas ativas" tabIndex={-1} ref={listRef} onScroll={(event) => {
          if (!isMobile || !showMobileDetail) listScrollRef.current = event.currentTarget.scrollTop
        }}>
          {activeTables.map((table) => {
            const occupied = table.occupancy === 'occupied'
            const selected = selectedTable?.id === table.id
            const tab = table.openTableTab
            return (
              <button key={table.id} type="button" className="comanda-table-button" aria-pressed={selected} aria-controls={occupied ? 'comandas-detail' : undefined} disabled={!occupied && disabled} ref={table.id === selectedTableId ? selectedButtonRef : undefined} onClick={() => selectTable(table)}>
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
              <Button type="button" variant="secondary" className="comandas-mobile-back" ref={backButtonRef} onClick={() => setMobileDetailOpen(false)}>Voltar para mesas</Button>
              <h2 ref={detailHeadingRef} tabIndex={-1}>{selectedTable.openTableTab ? `Comanda ${selectedTable.openTableTab.number}` : 'Comanda aberta'}</h2>
              <div className="comanda-table-heading"><strong>{selectedTable.name}</strong><span className="comanda-status occupied">Ocupada</span></div>
              {selectedTable.openTableTab ? <div className="comanda-summary"><span>{itemSummary(selectedTable.openTableTab.itemCount)}</span><strong>{currency(selectedTable.openTableTab.totalCents / 100)}</strong></div> : <p>Resumo indisponível</p>}
              <Button type="button" onClick={() => onAddOrder?.(selectedTable.id)} disabled={disabled}>Adicionar pedido</Button>
            </>
          ) : <div className="empty-state"><Icon name="clipboard" size={28} /><strong>Selecione uma mesa ocupada.</strong><span>Confira aqui o resumo da comanda.</span></div>}
        </aside>
      </div>
    </div>
  )
}

export default Comandas
