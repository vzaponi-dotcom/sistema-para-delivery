import { useState } from 'react'
import Button from './Button'
import ConfirmationDialog from './ConfirmationDialog'
import Modal from './Modal'
import OrderDetailTiming from './OrderDetailTiming.jsx'
import OrderTicketPreview from './OrderTicketPreview'
import PaymentBadge from './PaymentBadge'
import PrintStatusBadge from './PrintStatusBadge'
import StatusBadge from './StatusBadge'
import { downloadOrderPdf } from '../printing/pdfOrderRenderer.js'
import { getOrderItemDisplayName, getOrderItems } from '../utils/orderCart.js'
import { formatOrderDate, formatOrderTime } from '../utils/orderWorkflow.js'
import { FINANCE_TIME_ZONE } from '../../shared/finance.js'
import { formatOrderDisplayNumber } from '../../shared/orderDisplayNumber.js'
import { getPrintJobActions } from '../../shared/printQueueActions.js'

const adjustmentLabel = (adjustment, currency) => {
  if (!adjustment || adjustment.type === 'none') return ''
  const prefix = adjustment.type === 'discount' ? 'Desconto' : 'Acréscimo'
  const value = adjustment.mode === 'percentage'
    ? `${Number(adjustment.value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
    : currency(adjustment.amount || adjustment.value || 0)
  return `${prefix} ${value}`
}

const formatPrintTimestamp = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: FINANCE_TIME_ZONE,
  }).format(date)
}

function OrderDetail({ order, currency, printing, printJob, onClose, onRequestCancel, onToast }) {
  const [previewDocument, setPreviewDocument] = useState(null)
  const [showTicketPreview, setShowTicketPreview] = useState(false)
  const [confirmReprint, setConfirmReprint] = useState(false)
  const [printingAction, setPrintingAction] = useState(null)

  if (!order) return null
  const items = getOrderItems(order)
  const adjustment = order.adjustment || { type: 'none' }
  const defaultCopies = printing?.localStation?.defaultCopies === 1 ? 1 : 2
  const reprintCopies = printJob?.copiesRequested === 1 ? 1 : defaultCopies
  const stationName = printing?.stations?.find((station) => station.id === printJob?.stationId)?.name || printJob?.stationId || '—'
  const printingDisabled = Boolean(printingAction)
  const now = new Date()
  const scheduledPrintPending = printJob?.trigger === 'automatic' && printJob?.status === 'pending' && printJob?.availableAt && new Date(printJob.availableAt) > now
  const awaitingSecondCopy = ['awaiting_second_copy', 'printed'].includes(printJob?.status)
    && Number(printJob?.copiesRequested) === 2
    && Number(printJob?.copiesPrinted) === 1
  const primaryQueueAction = getPrintJobActions(printJob, { order })[0]?.key || null

  const runPrintingAction = async (key, action, successMessage) => {
    if (printingAction || typeof action !== 'function') return false
    setPrintingAction(key)
    try {
      await action()
      if (successMessage) onToast?.(successMessage)
      return true
    } catch (error) {
      onToast?.(error?.message || 'Não foi possível concluir a ação de impressão.')
      return false
    } finally {
      setPrintingAction(null)
    }
  }

  const loadCurrentPrintDocument = async () => {
    if (!printing?.getPreviewDocument) throw new Error('Visualização do ticket indisponível.')
    return printing.getPreviewDocument(order.id)
  }

  const handlePreview = () => runPrintingAction('preview', async () => {
    const document = await loadCurrentPrintDocument()
    setPreviewDocument(document)
    setShowTicketPreview(true)
  })

  const handlePdf = () => runPrintingAction('pdf', async () => {
    const document = await loadCurrentPrintDocument()
    downloadOrderPdf(document)
  })

  const handleFirstPrint = () => runPrintingAction('print', () => printing?.printOrder?.(order.id, defaultCopies), 'Pedido enviado para a fila da cozinha')

  const handlePrintNow = () => runPrintingAction('print-now', () => printing?.requestPrintNow?.(printJob), 'Pedido priorizado na fila')

  const handleSecondCopy = () => runPrintingAction('second-copy', () => printing?.requestSecondCopy?.(printJob), '2ª via enviada para a fila')

  const handleRetry = () => runPrintingAction('retry', () => printing?.requestRetry?.(printJob), 'Nova tentativa enviada para a fila')

  const handleForcePrint = () => runPrintingAction('force-print', () => printing?.requestForcePrint?.(printJob), 'Impressão autorizada e enviada para a fila')

  const handleConfirmedReprint = async () => {
    const printed = await runPrintingAction('reprint', () => printing?.requestReprint?.(printJob, reprintCopies), 'Reimpressão adicionada à fila')
    if (printed) setConfirmReprint(false)
  }

  const actionButton = (() => {
    if (!printJob) return <Button type="button" onClick={handleFirstPrint} disabled={printingDisabled}>Imprimir pedido</Button>
    if (scheduledPrintPending) return <Button type="button" onClick={handlePrintNow} disabled={printingDisabled}>Imprimir agora</Button>
    if (awaitingSecondCopy) return <Button type="button" onClick={handleSecondCopy} disabled={printingDisabled}>Imprimir 2ª via</Button>
    if (printJob.status === 'printed') return <Button type="button" onClick={() => setConfirmReprint(true)} disabled={printingDisabled}>Reimprimir</Button>
    if (primaryQueueAction === 'retry') return <Button type="button" onClick={handleRetry} disabled={printingDisabled}>Tentar novamente</Button>
    if (primaryQueueAction === 'reprint') return <Button type="button" onClick={() => setConfirmReprint(true)} disabled={printingDisabled}>Reimprimir</Button>
    if (primaryQueueAction === 'forcePrint') return <Button type="button" onClick={handleForcePrint} disabled={printingDisabled}>Imprimir mesmo assim</Button>
    return null
  })()

  return (
    <>
      <Modal title={formatOrderDisplayNumber(order)} onClose={onClose}>
        <div className="order-detail">
          <section className="order-detail-section order-detail-summary-section">
            <div className="section-heading compact-section-heading"><h3>Resumo</h3></div>
            <div className="order-detail-heading">
              <div>
                <span>Cliente</span>
                <strong>{order.client}</strong>
              </div>
              <div className="order-detail-badges">
                <StatusBadge status={order.status} />
                <PaymentBadge order={order} />
                {printJob && <PrintStatusBadge job={printJob} />}
              </div>
            </div>
            <div className="order-detail-meta">
              <div><span>Tipo</span><strong>{order.type}</strong></div>
              <div><span>Data</span><strong>{formatOrderDate(order.orderDate)}</strong></div>
              <div><span>Horário</span><strong>{formatOrderTime(order.createdAt) || '—'}</strong></div>
              <div><span>Forma de pagamento</span><strong>{order.paymentStatus === 'Pago' ? (order.paymentMethod || 'Não informada') : 'Pendente'}</strong></div>
              {order.clientPhone && <div><span>Telefone</span><strong>{order.clientPhone}</strong></div>}
              {order.clientAddress && <div><span>Endereço</span><strong>{order.clientAddress}</strong></div>}
            </div>
          </section>

          <section className="order-detail-section order-timing-section">
            <div className="section-heading compact-section-heading"><h3>Horários</h3></div>
            <OrderDetailTiming order={order} />
          </section>

          <section className="order-detail-section">
            <div className="section-heading compact-section-heading">
              <div>
                <h3>Itens</h3>
              </div>
            </div>
            <div className="order-detail-items">
              {items.map((item) => (
                <div className="order-detail-item" key={item.id || item.lineId || `${item.productId}-${item.name}-${item.note}`}>
                  <div>
                    <strong>{item.quantity}x {getOrderItemDisplayName(item)}</strong>
                    {item.note && <span>↳ {item.note}</span>}
                  </div>
                  <strong>{currency(Number(item.unitPrice ?? item.catalogPrice ?? 0) * Number(item.quantity || 1))}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="order-detail-section order-detail-values-section">
            <div className="section-heading compact-section-heading"><h3>Valores</h3></div>
            <div className="order-detail-totals">
            <div><span>Subtotal</span><strong>{currency(order.subtotal ?? order.total ?? 0)}</strong></div>
            {Number(order.deliveryFee || 0) > 0 && <div><span>Taxa de entrega</span><strong>{currency(order.deliveryFee)}</strong></div>}
            {adjustment.type !== 'none' && (
              <>
                <div>
                  <span>{adjustmentLabel(adjustment, currency)}</span>
                  <strong>{adjustment.type === 'discount' ? '− ' : '+ '}{currency(adjustment.amount || 0)}</strong>
                </div>
                {adjustment.reason && <div className="order-detail-reason"><span>Motivo</span><strong>{adjustment.reason}</strong></div>}
              </>
            )}
            <div className="order-detail-total-final"><span>Total</span><strong>{currency(order.total)}</strong></div>
            </div>
            {onRequestCancel && <div className="order-detail-cancel-action"><Button type="button" variant="secondary" onClick={onRequestCancel}>Cancelar pedido</Button></div>}
          </section>

          <section className="order-detail-section order-printing-section">
            <div className="section-heading compact-section-heading">
              <div>
                <h3>Impressão</h3>
              </div>
              {printJob && <PrintStatusBadge job={printJob} />}
            </div>

            <div className="order-printing-actions">
              <Button type="button" variant="secondary" onClick={handlePreview} disabled={Boolean(printingAction)}>Visualizar ticket</Button>
              <Button type="button" variant="secondary" onClick={handlePdf} disabled={Boolean(printingAction)}>Gerar PDF</Button>
              {actionButton}
            </div>

            {!printJob && <p className="order-printing-helper">Este pedido ainda não possui histórico de impressão. Isso é esperado quando a impressão automática estava desligada.</p>}
            {scheduledPrintPending && <p className="order-printing-helper">Impressão programada para {formatOrderTime(printJob.availableAt)}</p>}
            {awaitingSecondCopy && <p className="order-printing-helper">1ª via impressa. A 2ª via continua pendente na fila da cozinha.</p>}
            {!scheduledPrintPending && !awaitingSecondCopy && ['pending', 'processing'].includes(printJob?.status) && <p className="order-printing-helper">A impressão já está na fila ou em andamento. Aguarde o resultado antes de gerar outra cópia física.</p>}

            {printJob && (
              <div className="order-printing-diagnostics">
                <div><span>Cópias</span><strong>{printJob.copiesPrinted || 0}/{printJob.copiesRequested}</strong></div>
                <div><span>Estação</span><strong>{stationName}</strong></div>
                <div><span>Processado em</span><strong>{formatPrintTimestamp(printJob.processedAt)}</strong></div>
                {printJob.lastError?.message && <div className="order-printing-diagnostic-error"><span>Diagnóstico</span><strong>{printJob.lastError.message}</strong></div>}
              </div>
            )}
          </section>
        </div>
      </Modal>

      {showTicketPreview && previewDocument && (
        <Modal title={`Visualização do ticket #${previewDocument.order?.number || ''}`} onClose={() => setShowTicketPreview(false)}>
          <OrderTicketPreview document={previewDocument} />
        </Modal>
      )}

      {confirmReprint && (
        <ConfirmationDialog
          title="Confirmar reimpressão"
          message={`Este pedido já foi enviado para impressão. Deseja imprimir mais ${reprintCopies} ${reprintCopies === 1 ? 'cópia' : 'cópias'}?`}
          confirmLabel="Reimprimir"
          confirmVariant="primary"
          onClose={() => setConfirmReprint(false)}
          onConfirm={handleConfirmedReprint}
          disabled={Boolean(printingAction)}
        />
      )}
    </>
  )
}

export default OrderDetail
