import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import '../comandas.css'
import Button from '../components/Button'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { useMediaQuery } from '../hooks/useMediaQuery.js'
import ComandaDetail from '../components/ComandaDetail'
import TableTabPaymentDialog from '../components/TableTabPaymentDialog'
import { getTableTabDetail } from '../api/client.js'

const defaultCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const itemSummary = (count) => `${count} ${count === 1 ? 'item' : 'itens'}`

function SelectedComanda({ table, tables, currency, disabled, onAddOrder, onPay, onApiError }) {
  const [snapshot, setSnapshot] = useState(null)
  const [retry, setRetry] = useState(0)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const errorHandler = useRef(onApiError)
  useLayoutEffect(() => { errorHandler.current = onApiError }, [onApiError])
  const tabId = table.openTableTab?.id
  const tableId = table.id
  useEffect(() => {
    let cancelled = false
    if (!tabId) return undefined
    const load = async () => {
      try {
        const { tableTab } = await getTableTabDetail(tabId)
        if (cancelled) return
        if (!tableTab || tableTab.id !== tabId || tableTab.status !== 'open' || tableTab.table?.id !== tableId) {
          throw new Error('Comanda indisponível, encerrada ou transferida. Atualize a consulta.')
        }
        setSnapshot({ tables, retry, detail: tableTab })
      } catch (error) {
        if (cancelled) return
        setSnapshot({ tables, retry, error: error.message || 'Não foi possível carregar a comanda.' })
        setPaymentOpen(false)
        if (error.status === 401) errorHandler.current?.(error)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [tabId, tableId, tables, retry])
  const current = snapshot?.tables === tables && snapshot?.retry === retry
  const detail = snapshot?.detail
  if (!tabId) return <p role="alert">Comanda indisponível. Aguarde a atualização das mesas.</p>
  return (
    <>
      {!current && <p role="status">{detail ? 'Atualizando comanda…' : 'Carregando comanda…'}</p>}
      {current && snapshot.error && <div role="alert"><p>{snapshot.error}</p><Button type="button" onClick={() => setRetry((value) => value + 1)}>Tentar novamente</Button></div>}
      {detail && <ComandaDetail detail={detail} labelledBy="comanda-heading" currency={currency} disabled={disabled} busyAction={!current} onAddOrder={() => onAddOrder?.(tableId)} onPay={() => setPaymentOpen(true)} />}
      <TableTabPaymentDialog open={paymentOpen} detail={detail} currency={currency} disabled={disabled || !current} onClose={() => setPaymentOpen(false)} onConfirm={onPay} />
    </>
  )
}

function Comandas({ tables = [], selectedTableId, onSelectTable, onAddOrder, onPay, onApiError, currency = defaultCurrency, disabled = false }) {
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
              <h2 id="comanda-heading" ref={detailHeadingRef} tabIndex={-1}>{selectedTable.openTableTab ? `Comanda ${selectedTable.openTableTab.number}` : 'Comanda aberta'}</h2>
              <SelectedComanda key={`${selectedTable.id}:${selectedTable.openTableTab?.id}`} table={selectedTable} tables={tables} currency={currency} disabled={disabled} onAddOrder={onAddOrder} onPay={onPay} onApiError={onApiError} />
            </>
          ) : <div className="empty-state"><Icon name="clipboard" size={28} /><strong>Selecione uma mesa ocupada.</strong><span>Confira aqui o resumo da comanda.</span></div>}
        </aside>
      </div>
    </div>
  )
}

export default Comandas
