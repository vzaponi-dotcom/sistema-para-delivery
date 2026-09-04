import { formatPrintMoneyCents } from '../../shared/orderPrintDocument.js'
import { encodeCp860 } from './cp860.js'
import { MTP5_PROFILE } from './mtp5Profile.js'

const ESC = 0x1b
const GS = 0x1d
const LF = Uint8Array.from([0x0a])

const command = (...bytes) => Uint8Array.from(bytes)
const initialize = () => command(ESC, 0x40)
const selectCodePage = (page) => command(ESC, 0x74, page)
const selectFontA = () => command(ESC, 0x4d, 0)
const align = (value) => command(ESC, 0x61, value)
const bold = (enabled) => command(ESC, 0x45, enabled ? 1 : 0)
const size = (value) => command(GS, 0x21, value)

const flattenBytes = (parts) => {
  const length = parts.reduce((total, part) => total + part.length, 0)
  const output = new Uint8Array(length)
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

const sanitizeText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

const hardWrapWord = (word, columns) => {
  const chunks = []
  for (let index = 0; index < word.length; index += columns) chunks.push(word.slice(index, index + columns))
  return chunks
}

export const wrapPrintText = (value, columns = MTP5_PROFILE.fontAColumns) => {
  const width = Math.max(1, Number(columns) || MTP5_PROFILE.fontAColumns)
  const paragraphs = String(value ?? '').replace(/\r/g, '').split('\n')
  const lines = []

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean)
    if (!words.length) {
      if (paragraphs.length > 1) lines.push('')
      continue
    }

    let current = ''
    for (const word of words) {
      const chunks = word.length > width ? hardWrapWord(word, width) : [word]
      for (const chunk of chunks) {
        if (!current) {
          current = chunk
          continue
        }
        if (`${current} ${chunk}`.length <= width) {
          current = `${current} ${chunk}`
        } else {
          lines.push(current)
          current = chunk
        }
      }
    }
    if (current) lines.push(current)
  }

  return lines
}

const pushRaw = (parts, ...raw) => parts.push(...raw)
const pushLine = (parts, text = '') => {
  parts.push(encodeCp860(text), LF)
}
const pushWrapped = (parts, text, { prefix = '', columns = MTP5_PROFILE.fontAColumns } = {}) => {
  const normalized = sanitizeText(text)
  if (!normalized) return
  const firstWidth = Math.max(1, columns - prefix.length)
  const firstLines = wrapPrintText(normalized, firstWidth)
  if (!prefix || !firstLines.length) {
    for (const line of wrapPrintText(normalized, columns)) pushLine(parts, line)
    return
  }
  pushLine(parts, `${prefix}${firstLines[0]}`)
  for (const line of firstLines.slice(1)) pushLine(parts, `${' '.repeat(prefix.length)}${line}`)
}

const divider = '-'.repeat(MTP5_PROFILE.fontAColumns)

const formatDateTime = (createdAt) => {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return sanitizeText(createdAt)
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date).replace(',', ' -')
}

const amountLine = (label, cents, sign = '') => `${label}: ${sign}${formatPrintMoneyCents(cents)}`

const renderOrderCopy = (document, copyNumber, copies) => {
  const parts = []
  pushRaw(parts, selectFontA(), size(0x00), bold(false), align(1))
  pushRaw(parts, bold(true))
  pushLine(parts, document.business?.name || 'Amor & Sabor')
  pushRaw(parts, size(0x11))
  pushLine(parts, `PEDIDO #${document.order?.number || ''}`)
  pushRaw(parts, size(0x00), bold(false))
  if (document.order?.createdAt) pushLine(parts, formatDateTime(document.order.createdAt))
  pushLine(parts, document.order?.type || '')
  pushRaw(parts, align(0))
  pushLine(parts, divider)

  pushWrapped(parts, document.customer?.name, { prefix: 'Cliente: ' })
  if (document.customer?.phone) pushWrapped(parts, document.customer.phone, { prefix: 'Telefone: ' })
  if (document.order?.type === 'Entrega' && document.customer?.address) {
    pushWrapped(parts, document.customer.address, { prefix: 'Endereço: ' })
  }

  pushLine(parts, divider)
  pushRaw(parts, bold(true))
  pushLine(parts, 'ITENS')
  pushRaw(parts, bold(false))

  for (const item of document.items || []) {
    const presentation = sanitizeText(item.presentation)
    const title = `${Number(item.quantity) || 1}x ${sanitizeText(item.name)}${presentation ? ` ${presentation}` : ''}`
    pushWrapped(parts, title)
    if (item.note) pushWrapped(parts, item.note, { prefix: 'Obs: ' })
    if (Number.isFinite(Number(item.lineTotalCents))) pushLine(parts, `  ${formatPrintMoneyCents(item.lineTotalCents)}`)
  }

  pushLine(parts, divider)
  pushLine(parts, amountLine('Subtotal', document.financial?.subtotalCents || 0))
  if (Number(document.financial?.deliveryFeeCents || 0) > 0) {
    pushLine(parts, amountLine('Taxa de entrega', document.financial.deliveryFeeCents))
  }
  const adjustment = document.financial?.adjustment || { type: 'none', amountCents: 0 }
  if (adjustment.type !== 'none' && Number(adjustment.amountCents || 0) > 0) {
    const label = adjustment.type === 'discount' ? 'Desconto' : 'Acréscimo'
    const sign = adjustment.type === 'discount' ? '-' : '+'
    pushLine(parts, amountLine(label, adjustment.amountCents, sign))
    if (adjustment.reason) pushWrapped(parts, adjustment.reason, { prefix: 'Motivo: ' })
  }

  pushRaw(parts, bold(true), size(0x11), align(1))
  pushLine(parts, `TOTAL ${formatPrintMoneyCents(document.financial?.totalCents || 0)}`)
  pushRaw(parts, size(0x00), bold(false), align(0))

  if (document.payment?.status === 'Pago') {
    pushLine(parts, `Pagamento: PAGO${document.payment.method ? ` - ${document.payment.method}` : ''}`)
  } else {
    pushLine(parts, 'Pagamento: PENDENTE')
  }

  pushLine(parts, divider)
  pushRaw(parts, align(1))
  pushLine(parts, `CÓPIA ${copyNumber}/${copies}`)
  pushLine(parts, `PEDIDO #${document.order?.number || ''}`)
  pushLine(parts, document.message || '')
  pushRaw(parts, align(0))
  return flattenBytes(parts)
}

const renderTestDocument = (document) => {
  const parts = [selectFontA(), size(0x00), bold(false), align(1), bold(true)]
  pushLine(parts, document.business?.name || 'Amor & Sabor')
  pushLine(parts, document.test?.title || 'TESTE DE IMPRESSÃO')
  pushRaw(parts, bold(false))
  pushWrapped(parts, document.test?.message || 'Impressora configurada com sucesso.')
  if (document.test?.createdAt) pushLine(parts, formatDateTime(document.test.createdAt))
  pushRaw(parts, align(0))
  return flattenBytes(parts)
}

export const renderEscPos58mm = (document, { copies = 1 } = {}) => {
  const count = Number(copies)
  if (count !== 1 && count !== 2) throw new RangeError('copies must be 1 or 2')
  if (!document || !['order', 'test'].includes(document.type)) throw new TypeError('Unsupported print document')

  const parts = [initialize(), selectCodePage(MTP5_PROFILE.codePage)]
  if (document.type === 'test') {
    parts.push(renderTestDocument(document))
  } else {
    for (let copyNumber = 1; copyNumber <= count; copyNumber += 1) {
      if (copyNumber > 1) parts.push(LF, LF)
      parts.push(renderOrderCopy(document, copyNumber, count))
    }
  }
  for (let index = 0; index < MTP5_PROFILE.feedLinesAfterJob; index += 1) parts.push(LF)
  return flattenBytes(parts)
}
