import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import '../comandas.css'
import Button from '../components/Button'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { useMediaQuery } from '../hooks/useMediaQuery.js'
import ComandaDetail from '../components/ComandaDetail'
import Modal from '../components/Modal'
import TableTabPaymentDialog from '../components/TableTabPaymentDialog'
import TableTabTicketPreview from '../components/TableTabTicketPreview'
import TableTransferDialog from '../components/TableTransferDialog'
import { getTableTabDetail } from '../api/client.js'

const defaultCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const itemSummary = (count) => `${count} ${count === 1 ? 'item' : 'itens'}`

function SelectedComanda({ table, tables, currency, disabled, canTransfer, onAddOrder, onPay, onTransfer, onApiError, onToast, printing }) {
  const [snapshot, setSnapshot] = useState({ loading: true })
  const refreshRef = useRef(null)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [previewDocument, setPreviewDocument] = useState(null)
  const [printingFeedback, setPrintingFeedback] = useState(null)
  const [activeAction, setActiveAction] = useState(null)
  const [transferSource, setTransferSource] = useState(null)
  const actionRef = useRef(null)
  const actionSequenceRef = useRef(0)
  const mountedRef = useRef(true)
  const errorHandler = useRef(onApiError)
  useLayoutEffect(() => { errorHandler.current = onApiError }, [onApiError])
  const tabId = table.openTableTab?.id
  const tableId = table.id
  useEffect(() => () => {
    mountedRef.current = false
    actionSequenceRef.current += 1
    actionRef.current = null
  }, [])
  useEffect(() => {
    let cancelled = false
    let inFlight = false
    let queued = false
    if (!tabId) return undefined
    const load = async () => {
      if (inFlight) { queued = true; return }
      inFlight = true
      setSnapshot((current) => current.detail ? { ...current, error: undefined } : { ...current, loading: true })
      try {
        const { tableTab } = await getTableTabDetail(tabId)
        if (cancelled) return
        if (!tableTab || tableTab.id !== tabId || tableTab.status !== 'open' || tableTab.table?.id !== tableId) {
          throw new Error('Comanda indisponível, encerrada ou transferida. Atualize a consulta.')
        }
        setSnapshot({ detail: tableTab, loading: false })
      } catch (error) {
        if (cancelled) return
        setSnapshot((current) => current.detail
          ? { ...current, loading: false }
          : { loading: false, error: error.message || 'Não foi possível carregar a comanda.' })
        setPaymentOpen(false)
        if (error.status === 401) errorHandler.current?.(error)
      } finally {
        inFlight = false
        if (!cancelled && queued) { queued = false; void load() }
      }
    }
    refreshRef.current = load
    return () => { cancelled = true; refreshRef.current = null }
  }, [tabId, tableId])
  useEffect(() => { void refreshRef.current?.() }, [tables, tabId, tableId])
  const runPrintingAction = async (kind, operation) => {
    if (actionRef.current || disabled) return
    const owner = { token: ++actionSequenceRef.current, tabId, tableId, kind }
    actionRef.current = owner
    setActiveAction(owner)
    setPrintingFeedback(null)
    const ownsAction = () => mountedRef.current && actionRef.current === owner
    try {
      const result = await operation()
      if (!ownsAction()) return
      if (kind === 'preview') {
        if (result?.type !== 'table-tab' || result.tableTab?.id !== tabId) {
          throw new Error('O ticket recebido n\u00e3o corresponde \u00e0 comanda selecionada. Tente novamente.')
        }
        setPreviewDocument(result)
      } else {
        setPrintingFeedback(null)
        onToast?.('Impress\u00e3o enviada para a fila')
      }
    } catch (error) {
      if (!ownsAction()) return
      setPrintingFeedback({ type: 'error', message: error?.message || 'N\u00e3o foi poss\u00edvel concluir a impress\u00e3o da comanda. Tente novamente.' })
      if (error?.status === 401) errorHandler.current?.(error)
    } finally {
      if (ownsAction()) {
        actionRef.current = null
        setActiveAction(null)
      }
    }
  }
  const current = !snapshot.loading
  const detail = snapshot?.detail
  if (!tabId) return <p role="alert">Comanda indisponível. Aguarde a atualização das mesas.</p>
  return (
    <>
      {!current && <p role="status">Carregando comanda…</p>}
      {current && snapshot.error && <div role="alert"><p>{snapshot.error}</p><Button type="button" onClick={() => refreshRef.current?.()}>Tentar novamente</Button></div>}
      {printingFeedback && <p role={printingFeedback.type === 'error' ? 'alert' : 'status'}>{printingFeedback.message}</p>}
      {detail && <ComandaDetail detail={detail} labelledBy="comanda-heading" currency={currency} disabled={disabled} busyAction={!current || Boolean(activeAction)} printingDisabled={!printing?.getTableTabPreviewDocument || !printing?.printTableTab} canTransfer={canTransfer} onAddOrder={() => onAddOrder?.(tableId, tabId)} onTransfer={() => setTransferSource({ ...table, openTableTab: { ...table.openTableTab, id: tabId } })} onViewTicket={() => runPrintingAction('preview', () => printing.getTableTabPreviewDocument(tabId))} onPrint={() => runPrintingAction('print', () => printing.printTableTab(tabId))} onPay={() => setPaymentOpen(true)} />}
      <TableTabPaymentDialog open={paymentOpen} detail={detail} currency={currency} disabled={disabled || !current} onClose={() => setPaymentOpen(false)} onConfirm={onPay} />
      {transferSource && <TableTransferDialog sourceTable={transferSource} tables={tables} disabled={disabled} onClose={() => setTransferSource(null)} onTransfer={onTransfer} />}
      {previewDocument && <Modal title={`Visualiza\u00e7\u00e3o da comanda ${previewDocument.tableTab.number}`} onClose={() => setPreviewDocument(null)}><TableTabTicketPreview document={previewDocument} /></Modal>}
    </>
  )
}

function Comandas({ tables = [], selection, selectionGeneration = 0, onSelectComanda, onAddOrder, onPay, canTransfer = false, onTransfer, onApiError, onToast, paymentSync, onRetryPaymentSync, printing, currency = defaultCurrency, disabled = false }) {
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
      const openedDetail = previous.isMobile && (!previous.showMobileDetail || previous.selectedTableId !== selection?.tableId)
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
    previousLayoutRef.current = { isMobile, showMobileDetail, selectedTableId: selection?.tableId ?? null }
  }, [isMobile, showMobileDetail, selection?.tableId])

  const selectTable = (table) => {
    if (table.occupancy === 'free') {
      if (!disabled) onAddOrder?.(table.id)
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
              <button key={table.id} type="button" className="comanda-table-button" aria-pressed={selected} aria-controls={occupied ? 'comandas-detail' : undefined} disabled={!occupied && disabled} ref={table.id === selection?.tableId ? selectedButtonRef : undefined} onClick={() => selectTable(table)}>
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
              <SelectedComanda key={`${selectionGeneration}:${selectedTable.id}:${selectedTable.openTableTab?.id}`} table={selectedTable} tables={tables} currency={currency} disabled={disabled || Boolean(paymentSync)} canTransfer={canTransfer} onAddOrder={onAddOrder} onPay={onPay} onTransfer={onTransfer} onApiError={onApiError} onToast={onToast} printing={printing} />
            </>
          ) : <div className="empty-state"><Icon name="clipboard" size={28} /><strong>Selecione uma mesa ocupada.</strong><span>Confira aqui o resumo da comanda.</span></div>}
        </aside>
      </div>
    </div>
  )
}

export default Comandas
