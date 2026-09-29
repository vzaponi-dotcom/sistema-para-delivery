import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { FINANCE_TIME_ZONE } from '../../../../shared/finance.js'
import '../../../comandas.css'
import '../../../comandas-table-list-polish.css'
import Button from '../../../shared/ui/Button'
import Icon from '../../../shared/ui/Icon'
import PageHeader from '../../../shared/ui/PageHeader'
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery.js'
import ComandaDetail from './ComandaDetail.jsx'
import TableReservationDetail from './TableReservationDetail.jsx'
import TableTransferDialog from './TableTransferDialog.jsx'
import { useTableTabDetail } from '../application/useTableTabDetail.js'
import { useTableReservationDetail } from '../application/useTableReservationDetail.js'

const defaultCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const itemSummary = (count) => `${count} ${count === 1 ? 'item' : 'itens'}`
const reservationDateTime = (value) => new Intl.DateTimeFormat('pt-BR', {
  timeZone: FINANCE_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
}).format(new Date(value)).replace(',', ' ·')

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

function SelectedReservation({
  reservation,
  tables,
  currency,
  disabled,
  actionKey,
  canCreateOrders,
  canCancelOrders,
  cancellationOptions,
  cancellationRevision,
  currentTiming,
  now,
  headingRef,
  onApiError,
  onEditReservation,
  onConfirmReservationArrival,
  onCancelReservation,
  onMarkReservationNoShow,
}) {
  const {
    detail,
    loading,
    error,
    retry,
  } = useTableReservationDetail({
    selection: { reservationId: reservation.id },
    officialTables: tables,
    onUnauthorized: onApiError,
  })

  if (loading && !detail) return <p role="status">Carregando reserva…</p>
  if (error && !detail) {
    return <div role="alert"><p>{error}</p><Button type="button" onClick={() => retry()}>Tentar novamente</Button></div>
  }

  return detail ? (
    <TableReservationDetail
      detail={detail}
      headingRef={headingRef}
      currency={currency}
      disabled={disabled}
      actionKey={actionKey}
      canCreateOrders={canCreateOrders}
      canCancelOrders={canCancelOrders}
      cancellationOptions={cancellationOptions}
      cancellationRevision={cancellationRevision}
      currentTiming={currentTiming}
      now={now}
      onEdit={onEditReservation}
      onConfirmArrival={onConfirmReservationArrival}
      onCancel={onCancelReservation}
      onNoShow={onMarkReservationNoShow}
    />
  ) : null
}

function Comandas({
  tables = [],
  selection,
  selectionGeneration = 0,
  onSelectComanda,
  onAddOrder,
  canTransfer = false,
  canCreateOrders = true,
  canCancelOrders = false,
  canExecutePrinting = true,
  onTransfer,
  onApiError,
  onRequestPayment,
  onRequestPreview,
  onRequestPrint,
  onEditReservation,
  onConfirmReservationArrival,
  onCancelReservation,
  onMarkReservationNoShow,
  reservationActionKey = null,
  cancellationOptions = [],
  cancellationRevision = null,
  currentTiming,
  now = new Date(),
  printingBusy = false,
  printingFeedback = null,
  printingAvailable = false,
  paymentSync,
  onRetryPaymentSync,
  currency = defaultCurrency,
  disabled = false,
}) {
  const activeTables = tables.filter((table) => table.isActive).sort((left, right) => left.sortOrder - right.sortOrder)
  const selectedTable = activeTables.find((table) => table.id === selection?.tableId && table.occupancy === 'occupied' && table.openTableTab?.id === selection.tableTabId) || null
  const [selectedReservationId, setSelectedReservationId] = useState(null)
  const selectedReservationTable = activeTables.find((table) => table.nextReservation?.id === selectedReservationId) || null
  const selectedReservation = selectedReservationTable?.nextReservation || null
  const [mobileDetailOpen, setMobileDetailOpen] = useState(Boolean(selectedTable || selectedReservation))
  // Invalidate the opening intent as well as the visible detail. A later refresh
  // may reuse this identity, but only another user selection should reopen it.
  if (selectedReservationId && !selectedReservationTable) setSelectedReservationId(null)
  if (mobileDetailOpen && !selectedTable && !selectedReservationTable) setMobileDetailOpen(false)
  const listRef = useRef(null)
  const listScrollRef = useRef(0)
  const selectedButtonRef = useRef(null)
  const detailHeadingRef = useRef(null)
  const pendingDetailFocusRef = useRef(false)
  const backButtonRef = useRef(null)
  const lastFocusedRef = useRef(null)
  const isMobile = useMediaQuery('(max-width: 820px)')
  const previousLayoutRef = useRef({ isMobile, showMobileDetail: false, selectedDetailKey: null })
  const selectedDetailKey = selectedReservation ? `reservation:${selectedReservation.id}` : (selectedTable ? `comanda:${selectedTable.id}` : null)
  const showMobileDetail = Boolean((selectedTable || selectedReservation) && mobileDetailOpen)

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
      const openedDetail = previous.isMobile && (!previous.showMobileDetail || previous.selectedDetailKey !== selectedDetailKey)
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
    previousLayoutRef.current = { isMobile, showMobileDetail, selectedDetailKey }
  }, [isMobile, showMobileDetail, selectedDetailKey, focusDetailHeading])

  const selectReservation = (table) => {
    const reservation = table.nextReservation
    if (!reservation?.id) return
    listScrollRef.current = listRef.current?.scrollTop || 0
    setSelectedReservationId(reservation.id)
    setMobileDetailOpen(true)
  }

  const selectTable = (table) => {
    if (table.occupancy === 'free') {
      if (table.nextReservation?.id) {
        selectReservation(table)
        return
      }
      if (canCreateOrders && !disabled) onAddOrder?.({ tableId: table.id, tableTabId: '', selectionGeneration })
      return
    }
    listScrollRef.current = listRef.current?.scrollTop || 0
    setSelectedReservationId(null)
    if (!table.openTableTab?.id) return
    onSelectComanda?.({ tableId: table.id, tableTabId: table.openTableTab.id })
    setMobileDetailOpen(true)
  }

  return (
    <div className={`comandas-page${showMobileDetail ? ' has-mobile-detail' : ''}`} onFocusCapture={(event) => { lastFocusedRef.current = event.target }} onBlurCapture={(event) => {
      if (event.relatedTarget) lastFocusedRef.current = null
    }}>
      <PageHeader title="Comandas" description="Acompanhe mesas, comandas e reservas." />
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
            const reservation = table.nextReservation || null
            const reservedFree = !occupied && Boolean(reservation)
            const selected = reservedFree
              ? selectedReservationId === reservation?.id
              : selectedTable?.id === table.id
            const reservationSelected = selectedReservationId === reservation?.id
            const tab = table.openTableTab
            const mainRef = reservedFree
              ? (reservationSelected ? selectedButtonRef : undefined)
              : (table.id === selection?.tableId ? selectedButtonRef : undefined)
            return (
              <div key={table.id} className={`comanda-table-card${reservation ? ' has-reservation' : ''}`}>
                <button
                  type="button"
                  className={`comanda-table-button ${occupied ? 'is-occupied' : reservedFree ? 'is-reserved' : 'is-free'}`}
                  aria-pressed={selected}
                  aria-controls={(occupied || reservedFree) ? 'comandas-detail' : undefined}
                  disabled={!occupied && !reservedFree && (disabled || !canCreateOrders)}
                  ref={mainRef}
                  onClick={() => selectTable(table)}
                >
                  <span className="comanda-table-icon" aria-hidden="true"><Icon name="table" size={20} /></span>
                  <span className="comanda-table-copy">
                    <strong className="comanda-table-name">{table.name}</strong>
                    <span className={`comanda-status ${occupied ? 'occupied' : reservedFree ? 'reserved' : 'free'}`}>
                      {occupied ? 'Ocupada' : reservedFree ? 'Reservada' : 'Livre'}
                    </span>
                    {occupied
                      ? (tab
                          ? <><span className="comanda-table-tab">Comanda {tab.number}</span><span className="comanda-table-items">{itemSummary(tab.itemCount)}</span></>
                          : <span className="comanda-table-tab">Resumo indisponível</span>)
                      : reservedFree
                        ? <><span className="comanda-table-tab">{reservation.clientName || 'Reserva'}</span><span className="comanda-table-items">{reservationDateTime(reservation.scheduledFor)} · {itemSummary(reservation.itemCount)}</span></>
                        : <span className="comanda-table-hint">Toque para lançar pedido</span>}
                  </span>
                  {occupied && tab && <strong className="comanda-table-total">{currency(tab.totalCents / 100)}</strong>}
                </button>
                {occupied && reservation && (
                  <button
                    type="button"
                    className="comanda-reservation-button"
                    aria-pressed={reservationSelected}
                    aria-controls="comandas-detail"
                    ref={reservationSelected ? selectedButtonRef : undefined}
                    onClick={() => selectReservation(table)}
                  >
                    <span className="comanda-status reserved">Reservada</span>
                    <strong>{reservation.clientName || 'Reserva'}</strong>
                    <time dateTime={reservation.scheduledFor}>{reservationDateTime(reservation.scheduledFor)}</time>
                  </button>
                )}
              </div>
            )
          })}
          {!activeTables.length && <div className="empty-state" role="status"><Icon name="table" size={28} /><strong>Nenhuma mesa ativa</strong><span>Ative ou cadastre mesas na área Mesas.</span></div>}
        </section>
        <aside id="comandas-detail" className="comandas-detail-panel surface-card" aria-label="Detalhe da comanda">
          {selectedReservation ? (
            <>
              <Button type="button" variant="secondary" className="comandas-mobile-back" ref={backButtonRef} onClick={() => setMobileDetailOpen(false)}>Voltar para mesas</Button>
              <SelectedReservation
                key={selectedReservation.id}
                reservation={selectedReservation}
                tables={tables}
                headingRef={setDetailHeadingRef}
                currency={currency}
                disabled={disabled}
                actionKey={reservationActionKey}
                canCreateOrders={canCreateOrders}
                canCancelOrders={canCancelOrders}
                cancellationOptions={cancellationOptions}
                cancellationRevision={cancellationRevision}
                currentTiming={currentTiming}
                now={now}
                onApiError={onApiError}
                onEditReservation={onEditReservation}
                onConfirmReservationArrival={onConfirmReservationArrival}
                onCancelReservation={onCancelReservation}
                onMarkReservationNoShow={onMarkReservationNoShow}
              />
            </>
          ) : selectedTable ? (
            <>
              <Button type="button" variant="secondary" className="comandas-mobile-back" ref={backButtonRef} onClick={() => setMobileDetailOpen(false)}>Voltar para mesas</Button>
              <SelectedComanda key={`${selectionGeneration}:${selectedTable.id}:${selectedTable.openTableTab?.id}`} table={selectedTable} tables={tables} selectionGeneration={selectionGeneration} headingRef={setDetailHeadingRef} currency={currency} disabled={disabled || Boolean(paymentSync)} canTransfer={canTransfer} canCreateOrders={canCreateOrders} canExecutePrinting={canExecutePrinting} onAddOrder={onAddOrder} onTransfer={onTransfer} onApiError={onApiError} onRequestPayment={onRequestPayment} onRequestPreview={onRequestPreview} onRequestPrint={onRequestPrint} printingBusy={printingBusy} printingFeedback={printingFeedback} printingAvailable={printingAvailable} />
            </>
          ) : <div className="empty-state"><Icon name="clipboard" size={28} /><strong>Selecione uma mesa ocupada.</strong><span>Confira aqui o resumo da comanda ou da reserva.</span></div>}
        </aside>
      </div>
    </div>
  )
}

export default Comandas