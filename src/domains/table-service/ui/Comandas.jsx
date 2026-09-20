import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import '../../../comandas.css'
import '../../../comandas-table-list-polish.css'
import Button from '../../../shared/ui/Button'
import Icon from '../../../shared/ui/Icon'
import PageHeader from '../../../shared/ui/PageHeader'
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery.js'
import ComandaDetail from './ComandaDetail.jsx'
import TableTransferDialog from './TableTransferDialog.jsx'
import { useTableTabDetail } from '../application/useTableTabDetail.js'

const defaultCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const itemSummary = (count) => `${count} ${count === 1 ? 'item' : 'itens'}`

function SelectedComanda({
  table,
  tables,
  selectionGeneration,
  currency,
  disabled,
  canTransfer,
  canCreateOrders,
  canExecutePrinting,
  onAddOrder,
  onTransfer,
  onApiError,
  onRequestPayment,
  onRequestPreview,
  onRequestPrint,
  printingBusy,
  printingFeedback,
  printingAvailable,
  headingRef,
}) {
  const [transferSource, setTransferSource] = useState(null)
  const tabId = table.openTableTab?.id
  const tableId = table.id
  const {
    detail,
    loading,
    error: detailError,
    retry: retryDetail,
  } = useTableTabDetail({
    selection: { tableId, tableTabId: tabId },
    officialTables: tables,
    onUnauthorized: onApiError,
  })
  const current = !loading
  const owner = { tableId, tableTabId: tabId, selectionGeneration }

  if (!tabId) return <p role="alert">Comanda indisponível. Aguarde a atualização das mesas.</p>

  return (
    <>
      {!current && <p role="status">Carregando comanda…</p>}
      {current && detailError && <div role="alert"><p>{detailError}</p><Button type="button" onClick={() => retryDetail()}>Tentar novamente</Button></div>}
      {printingFeedback && <p role={printingFeedback.type === 'error' ? 'alert' : 'status'}>{printingFeedback.message}</p>}
      {detail && (
        <ComandaDetail
          detail={detail}
          headingId="comanda-heading"
          headingRef={headingRef}
          currency={currency}
          disabled={disabled}
          busyAction={!current || Boolean(printingBusy)}
          printingDisabled={!printingAvailable}
          canTransfer={canTransfer}
          canCreateOrders={canCreateOrders}
          canExecutePrinting={canExecutePrinting}
          onAddOrder={() => { if (canCreateOrders) onAddOrder?.(owner) }}
          onTransfer={() => setTransferSource({ ...table, openTableTab: { ...table.openTableTab, id: tabId } })}
          onViewTicket={() => onRequestPreview?.(owner)}
          onPrint={() => onRequestPrint?.(owner)}
          onPay={() => onRequestPayment?.({ ...owner, detail })}
        />
      )}
      {transferSource && <TableTransferDialog sourceTable={transferSource} tables={tables} disabled={disabled} onClose={() => setTransferSource(null)} onTransfer={onTransfer} />}
    </>
  )
}

function Comandas({ tables = [], selection, selectionGeneration = 0, onSelectComanda, onAddOrder, canTransfer = false, canCreateOrders = true, canExecutePrinting = true, onTransfer, onApiError, onRequestPayment, onRequestPreview, onRequestPrint, printingBusy = false, printingFeedback = null, printingAvailable = false, paymentSync, onRetryPaymentSync, currency = defaultCurrency, disabled = false }) {
  const activeTables = tables.filter((table) => table.isActive).sort((left, right) => left.sortOrder - right.sortOrder)
  const selectedTable = activeTables.find((table) => table.id === selection?.tableId && table.occupancy === 'occupied' && table.openTableTab?.id === selection.tableTabId) || null
  const [mobileDetailOpen, setMobileDetailOpen] = useState(Boolean(selectedTable))
  // Invalidate the opening intent as well as the visible detail. A later refresh
  // may reuse this table ID, but only another user selection should reopen it.
  if (mobileDetailOpen && !selectedTable) setMobileDetailOpen(false)
  const listRef = useRef(null)
  const listScrollRef = useRef(0)
  const selectedButtonRef = useRef(null)
  const detailHeadingRef = useRef(null)
  const pendingDetailFocusRef = useRef(false)
  const backButtonRef = useRef(null)
  const lastFocusedRef = useRef(null)
  const isMobile = useMediaQuery('(max-width: 820px)')
  const previousLayoutRef = useRef({ isMobile, showMobileDetail: false, selectedTableId: null })
  const showMobileDetail = Boolean(selectedTable && mobileDetailOpen)

  const setDetailHeadingRef = useCallback((node) => {
    detailHeadingRef.current = node
    if (node && pendingDetailFocusRef.current) {
      pendingDetailFocusRef.current = false
      node.focus({ preventScroll: true })
    }
  }, [])

  const focusDetailHeading = useCallback(() => {
    if (detailHeadingRef.current) {
      pendingDetailFocusRef.current = false
      detailHeadingRef.current.focus({ preventScroll: true })
      return
    }
    pendingDetailFocusRef.current = true
  }, [])

  useLayoutEffect(() => {
    const previous = previousLayoutRef.current
    // CSS can blur a newly hidden element before the media-query notification.
    const focused = document.activeElement === document.body ? lastFocusedRef.current : document.activeElement
    if (isMobile && showMobileDetail) {
      const openedDetail = previous.isMobile && (!previous.showMobileDetail || previous.selectedTableId !== selection?.tableId)
      const hidFocusedList = !previous.isMobile && listRef.current?.contains(focused)
      if (openedDetail || hidFocusedList) focusDetailHeading()
    } else if (previous.isMobile && previous.showMobileDetail && !showMobileDetail) {
      pendingDetailFocusRef.current = false
      if (listRef.current) listRef.current.scrollTop = listScrollRef.current
      const selectedButton = selectedButtonRef.current
      const target = selectedButton && !selectedButton.disabled
        ? selectedButton
        : listRef.current?.querySelector('button:not(:disabled)') || listRef.current
      target?.focus({ preventScroll: true })
    } else if (!isMobile && previous.isMobile && focused && focused === backButtonRef.current) {
      focusDetailHeading()
    }
    previousLayoutRef.current = { isMobile, showMobileDetail, selectedTableId: selection?.tableId ?? null }
  }, [isMobile, showMobileDetail, selection?.tableId, focusDetailHeading])

  const selectTable = (table) => {
    if (table.occupancy === 'free') {
      if (canCreateOrders && !disabled) onAddOrder?.({ tableId: table.id, tableTabId: '', selectionGeneration })
      return
    }
    listScrollRef.current = listRef.current?.scrollTop || 0
    if (!table.openTableTab?.id) return
    onSelectComanda?.({ tableId: table.id, tableTabId: table.openTableTab.id })
    setMobileDetailOpen(true)
  }

  return (
    <div className={`comandas-page${showMobileDetail ? ' has-mobile-detail' : ''}`} onFocusCapture={(event) => { lastFocusedRef.current = event.target }} onBlurCapture={(event) => {
      if (event.relatedTarget) lastFocusedRef.current = null
    }}>
      <PageHeader title="Comandas" description="Acompanhe mesas e comandas abertas." />
      {paymentSync && <div role={paymentSync.status === 'error' ? 'alert' : 'status'}>
        <p>Pagamento registrado. {paymentSync.status === 'error' ? 'Não foi possível confirmar a sincronização das mesas. Tente sincronizar novamente.' : 'Aguardando sincronização das mesas…'}</p>
        {paymentSync.status === 'error' && <Button type="button" onClick={onRetryPaymentSync}>Tentar sincronizar</Button>}
      </div>}
      <div className="comandas-workspace">
        <section className="comandas-list-panel" aria-label="Mesas ativas" tabIndex={-1} ref={listRef} onScroll={(event) => {
          if (!isMobile || !showMobileDetail) listScrollRef.current = event.currentTarget.scrollTop
        }}>
          {activeTables.map((table) => {
            const occupied = table.occupancy === 'occupied'
            const selected = selectedTable?.id === table.id
            const tab = table.openTableTab
            return (
              <button key={table.id} type="button" className={`comanda-table-button ${occupied ? 'is-occupied' : 'is-free'}`} aria-pressed={selected} aria-controls={occupied ? 'comandas-detail' : undefined} disabled={!occupied && (disabled || !canCreateOrders)} ref={table.id === selection?.tableId ? selectedButtonRef : undefined} onClick={() => selectTable(table)}>
                <span className="comanda-table-icon" aria-hidden="true"><Icon name="table" size={20} /></span>
                <span className="comanda-table-copy">
                  <strong className="comanda-table-name">{table.name}</strong>
                  <span className={`comanda-status ${occupied ? 'occupied' : 'free'}`}>{occupied ? 'Ocupada' : 'Livre'}</span>
                  {occupied
                    ? (tab
                        ? <><span className="comanda-table-tab">Comanda {tab.number}</span><span className="comanda-table-items">{itemSummary(tab.itemCount)}</span></>
                        : <span className="comanda-table-tab">Resumo indisponível</span>)
                    : <span className="comanda-table-hint">Toque para lançar pedido</span>}
                </span>
                {occupied && tab && <strong className="comanda-table-total">{currency(tab.totalCents / 100)}</strong>}
              </button>
            )
          })}
          {!activeTables.length && <div className="empty-state" role="status"><Icon name="table" size={28} /><strong>Nenhuma mesa ativa</strong><span>Ative ou cadastre mesas na área Mesas.</span></div>}
        </section>
        <aside id="comandas-detail" className="comandas-detail-panel surface-card" aria-label="Detalhe da comanda">
          {selectedTable ? (
            <>
              <Button type="button" variant="secondary" className="comandas-mobile-back" ref={backButtonRef} onClick={() => setMobileDetailOpen(false)}>Voltar para mesas</Button>
              <SelectedComanda key={`${selectionGeneration}:${selectedTable.id}:${selectedTable.openTableTab?.id}`} table={selectedTable} tables={tables} selectionGeneration={selectionGeneration} headingRef={setDetailHeadingRef} currency={currency} disabled={disabled || Boolean(paymentSync)} canTransfer={canTransfer} canCreateOrders={canCreateOrders} canExecutePrinting={canExecutePrinting} onAddOrder={onAddOrder} onTransfer={onTransfer} onApiError={onApiError} onRequestPayment={onRequestPayment} onRequestPreview={onRequestPreview} onRequestPrint={onRequestPrint} printingBusy={printingBusy} printingFeedback={printingFeedback} printingAvailable={printingAvailable} />
            </>
          ) : <div className="empty-state"><Icon name="clipboard" size={28} /><strong>Selecione uma mesa ocupada.</strong><span>Confira aqui o resumo da comanda.</span></div>}
        </aside>
      </div>
    </div>
  )
}

export default Comandas