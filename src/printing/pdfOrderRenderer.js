import { jsPDF } from 'jspdf'
import { formatPrintMoneyCents } from '../../shared/orderPrintDocument.js'
import { FINANCE_TIME_ZONE } from '../../shared/finance.js'

const A5 = { orientation: 'portrait', unit: 'mm', format: 'a5' }
const MARGIN = 12
const LINE_HEIGHT = 5
const sanitize = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

const formatDateTime = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return sanitize(value)
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FINANCE_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date).replace(',', ' -')
}

export const getOrderPdfFilename = (document) => {
  const number = sanitize(document?.order?.number || document?.order?.id || 'pedido')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
  return `pedido-${number}.pdf`
}

export const renderOrderPdf = (document, { jsPDFFactory = (options) => new jsPDF(options) } = {}) => {
  if (!document || document.type !== 'order') throw new TypeError('Order print document is required')
  const pdf = jsPDFFactory({ ...A5 })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const maxWidth = pageWidth - (MARGIN * 2)
  let y = MARGIN

  const ensureSpace = (needed = LINE_HEIGHT) => {
    if (y + needed <= pageHeight - MARGIN) return
    pdf.addPage()
    y = MARGIN
  }
  const write = (text, { size = 10, bold = false, gapAfter = 0 } = {}) => {
    const value = sanitize(text)
    if (!value) return
    pdf.setFont('helvetica', bold ? 'bold' : 'normal')
    pdf.setFontSize(size)
    const lines = pdf.splitTextToSize(value, maxWidth)
    const normalized = Array.isArray(lines) ? lines : [lines]
    for (const line of normalized) {
      ensureSpace(LINE_HEIGHT)
      pdf.text(String(line), MARGIN, y)
      y += LINE_HEIGHT
    }
    y += gapAfter
  }
  const divider = () => {
    ensureSpace(4)
    pdf.setLineWidth(0.2)
    pdf.line(MARGIN, y, pageWidth - MARGIN, y)
    y += 4
  }

  write(document.business?.name || 'Amor & Sabor', { size: 15, bold: true })
  write(`PEDIDO #${sanitize(document.order?.number)}`, { size: 18, bold: true })
  if (document.order?.createdAt) write(formatDateTime(document.order.createdAt), { size: 9 })
  write(document.order?.type, { size: 10, gapAfter: 1 })
  divider()

  write(`Cliente: ${document.customer?.name || ''}`)
  if (document.customer?.phone) write(`Telefone: ${document.customer.phone}`)
  if (document.order?.type === 'Entrega' && document.customer?.address) write(`Endereço: ${document.customer.address}`)
  divider()

  write('ITENS', { size: 11, bold: true })
  for (const item of document.items || []) {
    const presentation = sanitize(item.presentation)
    write(`${Number(item.quantity) || 1}x ${sanitize(item.name)}${presentation ? ` ${presentation}` : ''}`, { bold: true })
    if (item.note) write(`Obs: ${item.note}`, { size: 9 })
    if (Number.isFinite(Number(item.lineTotalCents))) write(formatPrintMoneyCents(item.lineTotalCents), { size: 9, gapAfter: 1 })
  }
  divider()

  write(`Subtotal: ${formatPrintMoneyCents(document.financial?.subtotalCents || 0)}`)
  if (Number(document.financial?.deliveryFeeCents || 0) > 0) {
    write(`Taxa de entrega: ${formatPrintMoneyCents(document.financial.deliveryFeeCents)}`)
  }
  const adjustment = document.financial?.adjustment || { type: 'none', amountCents: 0 }
  if (adjustment.type !== 'none' && Number(adjustment.amountCents || 0) > 0) {
    const label = adjustment.type === 'discount' ? 'Desconto' : 'Acréscimo'
    const sign = adjustment.type === 'discount' ? '-' : '+'
    write(`${label}: ${sign}${formatPrintMoneyCents(adjustment.amountCents)}`)
    if (adjustment.reason) write(`Motivo: ${adjustment.reason}`, { size: 9 })
  }
  write(`TOTAL ${formatPrintMoneyCents(document.financial?.totalCents || 0)}`, { size: 15, bold: true, gapAfter: 1 })

  if (document.payment?.status === 'Pago') {
    write(`Pagamento: PAGO${document.payment.method ? ` - ${document.payment.method}` : ''}`, { bold: true })
  } else {
    write('Pagamento: PENDENTE', { bold: true })
  }

  divider()
  write(document.message || '', { size: 10, gapAfter: 1 })
  return pdf.output('arraybuffer')
}

export const downloadOrderPdf = (document, {
  render = renderOrderPdf,
  urlApi = globalThis.URL,
  documentApi = globalThis.document,
} = {}) => {
  if (!documentApi?.createElement || !urlApi?.createObjectURL) throw new Error('Download de PDF indisponível neste ambiente.')
  const bytes = render(document)
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = urlApi.createObjectURL(blob)
  const anchor = documentApi.createElement('a')
  anchor.href = url
  anchor.download = getOrderPdfFilename(document)
  anchor.style.display = 'none'
  documentApi.body?.appendChild?.(anchor)
  try {
    anchor.click()
  } finally {
    anchor.remove?.()
    urlApi.revokeObjectURL(url)
  }
  return { filename: anchor.download, bytes }
}
