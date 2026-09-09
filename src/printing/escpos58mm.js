import { formatPrintMoneyCents } from '../../shared/orderPrintDocument.js'
import { FINANCE_TIME_ZONE } from '../../shared/finance.js'
import { decodeCp860Byte, encodeCp860 } from './cp860.js'
import { MTP5_PROFILE } from './mtp5Profile.js'

const ESC = 0x1b
const GS = 0x1d
const FS = 0x1c
const LF = Uint8Array.from([0x0a])

const command = (...bytes) => Uint8Array.from(bytes)
const initialize = () => command(ESC, 0x40)
const cancelChineseMode = () => command(FS, 0x2e)
const selectCodePage = (page) => command(ESC, 0x74, page)
const selectFontA = () => command(ESC, 0x4d, 0)
const align = (value) => command(ESC, 0x61, value)
const bold = (enabled) => command(ESC, 0x45, enabled ? 1 : 0)
const size = (value) => command(GS, 0x21, value)
const setLineSpacing = (dots) => command(ESC, 0x33, dots)
const restoreLineSpacing = () => command(ESC, 0x32)

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
const formatEscPosMoneyCents = (cents) => formatPrintMoneyCents(cents).replace(/[\u00a0\u202f]/g, ' ')

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
    timeZone: FINANCE_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date).replace(',', ' -')
}

const amountLine = (label, cents, sign = '') => `${label}: ${sign}${formatEscPosMoneyCents(cents)}`

const ORDER_TITLE_SIZE = 0x11
const SECONDARY_TEXT_SIZE = 0x00
const TOTAL_SIZE = 0x00

const renderOrderCopy = (document, copyNumber, copies) => {
  const parts = []
  pushRaw(parts, selectFontA(), size(0x00), bold(false), align(1))
  pushRaw(parts, bold(true))
  pushLine(parts, document.business?.name || 'Amor & Sabor')
  pushRaw(parts, size(ORDER_TITLE_SIZE))
  pushLine(parts, `PEDIDO #${document.order?.number || ''}`)
  pushRaw(parts, size(0x00), bold(false))
  if (document.order?.createdAt) pushLine(parts, formatDateTime(document.order.createdAt))
  pushLine(parts, document.order?.type || '')
  pushRaw(parts, align(0))
  pushLine(parts, divider)
  pushRaw(parts, size(SECONDARY_TEXT_SIZE))

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
    if (Number.isFinite(Number(item.lineTotalCents))) pushLine(parts, `  ${formatEscPosMoneyCents(item.lineTotalCents)}`)
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

  pushRaw(parts, bold(true), size(TOTAL_SIZE), align(1))
  pushLine(parts, `TOTAL ${formatEscPosMoneyCents(document.financial?.totalCents || 0)}`)
  pushRaw(parts, size(SECONDARY_TEXT_SIZE), bold(false), align(0))

  if (document.payment?.status === 'Pago') {
    pushLine(parts, `Pagamento: PAGO${document.payment.method ? ` - ${document.payment.method}` : ''}`)
  } else {
    pushLine(parts, 'Pagamento: PENDENTE')
  }

  pushLine(parts, divider)
  pushRaw(parts, align(1))
  pushLine(parts, `CÓPIA ${copyNumber}/${copies}`)
  pushLine(parts, `PEDIDO #${document.order?.number || ''}`)
  pushWrapped(parts, document.message || '')
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

const defaultCanvasFactory = () => {
  const canvas = globalThis.document?.createElement?.('canvas')
  if (!canvas) throw new Error('Canvas is unavailable for MPT-II bitmap rendering')
  return canvas
}

const parseTextLines = (bytes) => {
  let currentAlign = 0
  let currentBold = false
  let currentSize = 0
  let text = ''
  let lineStyle = null
  const lines = []

  const captureStyle = () => {
    if (!lineStyle) lineStyle = { align: currentAlign, bold: currentBold, size: currentSize }
  }
  const flushLine = () => {
    lines.push({ text, ...(lineStyle || { align: currentAlign, bold: currentBold, size: currentSize }) })
    text = ''
    lineStyle = null
  }

  for (let index = 0; index < bytes.length;) {
    const byte = bytes[index]
    if (byte === 0x0a) {
      flushLine()
      index += 1
      continue
    }
    if (byte === ESC) {
      const operation = bytes[index + 1]
      if (operation === 0x40) {
        currentAlign = 0
        currentBold = false
        currentSize = 0
        index += 2
        continue
      }
      if (operation === 0x74 || operation === 0x4d) {
        index += 3
        continue
      }
      if (operation === 0x61) {
        currentAlign = bytes[index + 2] ?? 0
        index += 3
        continue
      }
      if (operation === 0x45) {
        currentBold = Boolean(bytes[index + 2])
        index += 3
        continue
      }
    }
    if (byte === GS && bytes[index + 1] === 0x21) {
      currentSize = bytes[index + 2] ?? 0
      index += 3
      continue
    }
    if (byte === FS && bytes[index + 1] === 0x2e) {
      index += 2
      continue
    }
    if (byte < 0x20) {
      index += 1
      continue
    }
    captureStyle()
    text += decodeCp860Byte(byte)
    index += 1
  }
  if (text) flushLine()
  return lines
}

const isDarkPixel = (data, offset) => {
  const alpha = data[offset + 3]
  if (!alpha) return false
  return ((data[offset] + data[offset + 1] + data[offset + 2]) / 3) < 200
}

const rasterizeMpt2TextBytes = (bytes, createCanvas = defaultCanvasFactory) => {
  const width = MTP5_PROFILE.dotsPerLine
  const normalCellWidth = width / MTP5_PROFILE.fontAColumns
  const bandHeight = 24
  const lines = parseTextLines(bytes)
  const parts = [initialize(), cancelChineseMode(), setLineSpacing(bandHeight)]

  for (const line of lines) {
    if (!line.text) {
      parts.push(LF)
      continue
    }

    const widthMultiplier = ((line.size >> 4) & 0x07) + 1
    const heightMultiplier = (line.size & 0x07) + 1
    const lineHeight = bandHeight * heightMultiplier
    const cellWidth = normalCellWidth * widthMultiplier
    const characters = [...line.text]
    const textWidth = characters.length * cellWidth
    const startX = line.align === 1
      ? Math.max(0, (width - textWidth) / 2)
      : line.align === 2
        ? Math.max(0, width - textWidth)
        : 0

    const canvas = createCanvas()
    canvas.width = width
    canvas.height = lineHeight
    const context = canvas.getContext?.('2d')
    if (!context) throw new Error('Canvas 2D context is unavailable for MPT-II bitmap rendering')
    context.fillStyle = '#fff'
    context.fillRect(0, 0, width, lineHeight)
    context.fillStyle = '#000'
    context.font = `${line.bold ? '700' : '400'} ${25 * heightMultiplier}px monospace`
    context.textAlign = 'center'
    context.textBaseline = 'middle'

    characters.forEach((character, characterIndex) => {
      if (character === ' ') return
      const centerX = startX + (characterIndex * cellWidth) + (cellWidth / 2)
      context.fillText(character, centerX, lineHeight / 2)
    })

    const image = context.getImageData(0, 0, width, lineHeight)
    for (let bandStart = 0; bandStart < lineHeight; bandStart += bandHeight) {
      const packed = new Uint8Array(width * 3)
      for (let x = 0; x < width; x += 1) {
        for (let byteRow = 0; byteRow < 3; byteRow += 1) {
          let value = 0
          for (let bit = 0; bit < 8; bit += 1) {
            const y = bandStart + (byteRow * 8) + bit
            if (y >= lineHeight) continue
            const pixelOffset = ((y * width) + x) * 4
            if (isDarkPixel(image.data, pixelOffset)) value |= 0x80 >> bit
          }
          packed[(x * 3) + byteRow] = value
        }
      }
      parts.push(command(ESC, 0x2a, 33, width & 0xff, (width >> 8) & 0xff), packed, LF)
    }
  }

  parts.push(restoreLineSpacing())
  return flattenBytes(parts)
}

export const renderEscPos58mm = (document, {
  copies = 1,
  copyNumber = null,
  totalCopies = null,
  compatibilityMode = null,
  createCanvas = defaultCanvasFactory,
} = {}) => {
  const count = Number(copies)
  if (count !== 1 && count !== 2) throw new RangeError('copies must be 1 or 2')
  if (!document || !['order', 'test'].includes(document.type)) throw new TypeError('Unsupported print document')

  const selectedCopy = copyNumber == null && totalCopies == null
    ? null
    : { copyNumber: Number(copyNumber), totalCopies: Number(totalCopies) }

  if (selectedCopy) {
    if (document.type !== 'order' || count !== 1) throw new RangeError('selected copy rendering requires one order copy')
    if (![1, 2].includes(selectedCopy.totalCopies)
      || !Number.isInteger(selectedCopy.copyNumber)
      || selectedCopy.copyNumber < 1
      || selectedCopy.copyNumber > selectedCopy.totalCopies) {
      throw new RangeError('selected copy must be within totalCopies')
    }
  }

  const parts = [initialize(), cancelChineseMode(), selectCodePage(MTP5_PROFILE.codePage)]
  if (document.type === 'test') {
    parts.push(renderTestDocument(document))
  } else if (selectedCopy) {
    parts.push(renderOrderCopy(document, selectedCopy.copyNumber, selectedCopy.totalCopies))
  } else {
    for (let currentCopy = 1; currentCopy <= count; currentCopy += 1) {
      if (currentCopy > 1) parts.push(LF, LF)
      parts.push(renderOrderCopy(document, currentCopy, count))
    }
  }
  for (let index = 0; index < MTP5_PROFILE.feedLinesAfterJob; index += 1) parts.push(LF)

  const rendered = flattenBytes(parts)
  if (compatibilityMode === 'mpt2-bitmap') return rasterizeMpt2TextBytes(rendered, createCanvas)
  return rendered
}
