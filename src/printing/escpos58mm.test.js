import assert from 'node:assert/strict'
import test from 'node:test'
import { createOrderPrintDocument } from '../../shared/orderPrintDocument.js'
import { encodeCp860 } from './cp860.js'
import { renderEscPos58mm, wrapPrintText } from './escpos58mm.js'
import { MTP5_PROFILE } from './mtp5Profile.js'

const tableTabFixture = {
  version: 1,
  type: 'table-tab',
  business: { name: 'Restaurante A' },
  tableTab: {
    id: 'tab-1042',
    number: 1042,
    tableName: 'Mesa 1',
    openedAt: '2026-09-10T18:00:00.000Z',
    emittedAt: '2026-09-10T20:00:00.000Z',
  },
  items: [
    { name: 'X-Bacon', presentation: 'Grande', note: '', quantity: 2, lineTotalCents: 4400 },
    { name: 'X-Bacon', presentation: 'Grande', note: 'Sem cebola', quantity: 1, lineTotalCents: 2200 },
    { name: 'Suco', presentation: '500 ml', note: 'Sem gelo', quantity: 1, lineTotalCents: 2000 },
  ],
  financial: { totalCents: 8600 },
  message: 'PR\u00c9-CONTA \u2014 N\u00c3O \u00c9 COMPROVANTE DE PAGAMENTO',
}

const includesBytes = (haystack, needle) => {
  const source = [...haystack]
  const target = [...needle]
  return source.some((_, index) => target.every((byte, offset) => source[index + offset] === byte))
}

const countBytes = (haystack, needle) => {
  const source = [...haystack]
  const target = [...needle]
  let count = 0
  for (let index = 0; index <= source.length - target.length; index += 1) {
    if (target.every((byte, offset) => source[index + offset] === byte)) count += 1
  }
  return count
}

const styledLines = (bytes) => {
  const lines = []
  let size = 0
  let bold = false
  let align = 0
  let text = ''
  for (let index = 0; index < bytes.length;) {
    if (bytes[index] === 0x0a) {
      lines.push({ text, size, bold, align })
      text = ''
      index += 1
      continue
    }
    if (bytes[index] === 0x1b && bytes[index + 1] === 0x45) {
      bold = Boolean(bytes[index + 2])
      index += 3
      continue
    }
    if (bytes[index] === 0x1b && bytes[index + 1] === 0x61) {
      align = bytes[index + 2]
      index += 3
      continue
    }
    if (bytes[index] === 0x1b && [0x40, 0x4d, 0x61, 0x74].includes(bytes[index + 1])) {
      index += bytes[index + 1] === 0x40 ? 2 : 3
      continue
    }
    if (bytes[index] === 0x1d && bytes[index + 1] === 0x21) {
      size = bytes[index + 2]
      index += 3
      continue
    }
    if (bytes[index] < 0x20) {
      index += 1
      continue
    }
    text += String.fromCharCode(bytes[index])
    index += 1
  }
  return lines
}

const fixture = (overrides = {}) => createOrderPrintDocument({
  businessName: 'Amor & Sabor',
  orderId: 'order-0184',
  orderNumber: 184,
  orderDate: '2026-09-03',
  createdAt: '2026-09-03T23:31:00.000Z',
  type: 'Entrega',
  customer: {
    name: 'João Silva',
    phone: '(11) 99876-5432',
    address: 'Rua das Flores, 123 - Jardim das Acácias',
  },
  items: [
    { name: 'X-BURGER ESPECIAL', presentation: 'G', quantity: 2, note: 'Sem cebola e acrescentar bacon crocante', unitPriceCents: 3000 },
    { name: 'BATATA', presentation: 'G', quantity: 1, note: 'Cheddar e bacon', unitPriceCents: 1200 },
  ],
  subtotalCents: 7200,
  deliveryFeeCents: 800,
  adjustment: { type: 'discount', amountCents: 200, reason: 'fidelidade' },
  totalCents: 7800,
  payment: { status: 'Pago', method: 'Pix' },
  ...overrides,
})

test('MTP5 profile centralizes physical width, logical columns and code page', () => {
  assert.equal(MTP5_PROFILE.paperWidthMm, 58)
  assert.equal(MTP5_PROFILE.printableWidthMm, 48)
  assert.equal(MTP5_PROFILE.dotsPerLine, 384)
  assert.equal(MTP5_PROFILE.fontAColumns, 32)
  assert.equal(MTP5_PROFILE.codePage, 3)
  assert.equal(MTP5_PROFILE.feedLinesAfterJob, 2)
})

test('CP860 encoder preserves Portuguese ticket characters and replaces unsupported glyphs', () => {
  assert.deepEqual([...encodeCp860('João Ç')], [74, 111, 132, 111, 32, 128])
  assert.deepEqual([...encodeCp860('ç é ó ê Á')], [135, 32, 130, 32, 162, 32, 136, 32, 134])
  assert.deepEqual([...encodeCp860('🙂')], [63])
})

test('text wrapping never exceeds the 32-column normal-font budget', () => {
  const lines = wrapPrintText('Observação muito longa para testar a quebra automática sem cortar silenciosamente palavras e conteúdo.', 32)
  assert.equal(lines.every((line) => line.length <= 32), true)
  assert.equal(lines.join(' ').includes('silenciosamente'), true)

  const hardWrapped = wrapPrintText('ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890', 32)
  assert.deepEqual(hardWrapped, ['ABCDEFGHIJKLMNOPQRSTUVWXYZ123456', '7890'])
})

test('ticket hierarchy makes secondary text legible without letting TOTAL dominate', () => {
  const lines = styledLines(renderEscPos58mm(fixture()))
  const line = (prefix) => lines.find(({ text }) => text.startsWith(prefix))

  assert.equal(line('Cliente: ')?.size, 0x00)
  assert.equal(line('Telefone: ')?.size, 0x00)
  assert.equal(line('Endere')?.size, 0x00)
  assert.equal(line('2x X-BURGER')?.size, 0x00)
  assert.equal(line('Obs: ')?.size, 0x00)
  assert.equal(line('Subtotal: ')?.size, 0x00)
  assert.equal(line('Pagamento: ')?.size, 0x00)
  assert.equal(line('PEDIDO #')?.size, 0x11)
  assert.equal(line('TOTAL ')?.size, 0x00)
  assert.equal(line('TOTAL ')?.bold, true)
  assert.equal(line('TOTAL ')?.align, 1)
})

test('MPT-II ticket wraps the complete accented footer within 384 dots and leaves two extra feed lines', () => {
  const message = 'Obrigado pela compra! Agradecemos a preferência. Volte sempre.'
  const document = fixture()
  document.message = message
  const bytes = renderEscPos58mm(document, { copies: 1 })
  const lines = styledLines(bytes)
  const footerStart = lines.map(({ text }) => text).lastIndexOf('PEDIDO #184') + 1
  const footerLines = lines.slice(footerStart).filter(({ text }) => text)
  const trailingFeedLines = [...bytes].reverse().findIndex((byte) => byte !== 0x0a)

  assert.equal(footerLines.map(({ text }) => text).join(' ').includes('Obrigado pela compra!'), true)
  assert.equal(includesBytes(bytes, encodeCp860('Agradecemos a prefer')),
    true)
  assert.equal(footerLines.map(({ text }) => text).join(' ').includes('Volte sempre.'), true)
  assert.equal(footerLines.every(({ text }) => text.length <= MTP5_PROFILE.fontAColumns), true)
  assert.equal(footerLines.every(({ size }) => size === 0x00), true)
  assert.equal(trailingFeedLines, 2)
  assert.equal(MTP5_PROFILE.dotsPerLine, 384)
  assert.equal(MTP5_PROFILE.feedLinesAfterJob, 2)
})

test('58mm renderer emits deterministic ESC/POS structure and two approved copies without cut command', () => {
  const bytes = renderEscPos58mm(fixture(), { copies: 2 })

  assert.equal(includesBytes(bytes, Uint8Array.from([0x1b, 0x40])), true)
  assert.equal(includesBytes(bytes, Uint8Array.from([0x1b, 0x74, 0x03])), true)
  assert.equal(includesBytes(bytes, encodeCp860('PEDIDO #184')), true)
  assert.equal(includesBytes(bytes, encodeCp860('João Silva')), true)
  assert.equal(includesBytes(bytes, encodeCp860('sem cebola')), false)
  assert.equal(includesBytes(bytes, encodeCp860('Sem cebola')), true)
  assert.equal(includesBytes(bytes, encodeCp860('TOTAL')), true)
  assert.equal(includesBytes(bytes, encodeCp860('Pix')), true)
  assert.equal(includesBytes(bytes, encodeCp860('Obrigado pela compra!')), true)
  assert.equal(countBytes(bytes, encodeCp860('CÓPIA 1/2')), 1)
  assert.equal(countBytes(bytes, encodeCp860('CÓPIA 2/2')), 1)
  assert.equal(includesBytes(bytes, Uint8Array.from([0x1d, 0x56])), false)
})

test('renderer can emit only the selected second physical copy while preserving the 2-copy label', () => {
  const bytes = renderEscPos58mm(fixture(), { copies: 1, copyNumber: 2, totalCopies: 2 })

  assert.equal(countBytes(bytes, encodeCp860('CÓPIA 1/2')), 0)
  assert.equal(countBytes(bytes, encodeCp860('CÓPIA 2/2')), 1)
  assert.equal(countBytes(bytes, encodeCp860('PEDIDO #184')), 2)
})

test('MPT-II byte stream exits Chinese mode, keeps Portuguese accents and uses ASCII money spacing', () => {
  const document = fixture({
    customer: { name: 'João', phone: '', address: 'Endereço com observação' },
    items: [{ name: 'Sanduíche', presentation: 'Un', quantity: 1, note: 'Acréscimo de queijo', unitPriceCents: 1800 }],
    subtotalCents: 1800,
    deliveryFeeCents: 0,
    adjustment: { type: 'none', amountCents: 0, reason: '' },
    totalCents: 1800,
    payment: { status: 'Pendente', method: '' },
  })
  const bytes = renderEscPos58mm(document, { copies: 1 })
  const chineseModeOff = Uint8Array.from([0x1c, 0x2e])
  const codePage = Uint8Array.from([0x1b, 0x74, MTP5_PROFILE.codePage])

  assert.equal(includesBytes(bytes, chineseModeOff), true)
  assert.equal(includesBytes(bytes, codePage), true)
  assert.equal(includesBytes(bytes, encodeCp860('Sanduíche')), true)
  assert.equal(includesBytes(bytes, encodeCp860('Endereço')), true)
  assert.equal(includesBytes(bytes, encodeCp860('João')), true)
  assert.equal(includesBytes(bytes, encodeCp860('Acréscimo')), true)
  assert.equal(includesBytes(bytes, encodeCp860('R$ 18,00')), true)
  assert.equal(bytes.includes(0xff), false)
})

test('MPT-II bitmap compatibility renders accented Unicode through ESC * 33 instead of printer code pages', () => {
  const document = fixture({
    customer: { name: 'João', phone: '', address: 'Endereço com observação' },
    items: [{ name: 'Sanduíche', presentation: 'Un', quantity: 1, note: 'Acréscimo de queijo', unitPriceCents: 1800 }],
    subtotalCents: 1800,
    deliveryFeeCents: 0,
    adjustment: { type: 'none', amountCents: 0, reason: '' },
    totalCents: 1800,
    payment: { status: 'Pendente', method: '' },
  })
  const drawnCharacters = []
  const drawnFonts = []
  const drawnSamples = []
  const createCanvas = () => {
    const canvas = { width: 0, height: 0 }
    const context = {
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: '',
      fillRect() {},
      fillText(character) {
        drawnCharacters.push(character)
        drawnFonts.push(this.font)
        drawnSamples.push({ font: this.font, height: canvas.height })
      },
      getImageData() {
        const data = new Uint8ClampedArray(canvas.width * canvas.height * 4)
        data.fill(255)
        return { data }
      },
    }
    canvas.getContext = () => context
    return canvas
  }

  const bytes = renderEscPos58mm(document, {
    copies: 1,
    compatibilityMode: 'mpt2-bitmap',
    createCanvas,
  })
  const drawnText = drawnCharacters.join('')

  assert.equal(drawnText.includes('Sanduíche'), true)
  assert.equal(drawnText.includes('Endereço'), true)
  assert.equal(drawnText.includes('João'), true)
  assert.equal(drawnText.includes('Acréscimo'), true)
  assert.equal(drawnText.includes('CÓPIA'), true)
  const rasterFontSizes = drawnSamples.map(({ font }) => Number.parseInt(font.match(/ (\d+)px /)?.[1] || '0', 10))
  assert.equal(rasterFontSizes.includes(27), true)
  assert.equal(rasterFontSizes.includes(48), false)
  const normalSamples = drawnSamples.filter(({ font }) => font.includes(' 27px '))
  assert.equal(normalSamples.length > 0, true)
  assert.equal(normalSamples.every(({ height }) => height === 24), true)
  assert.equal(includesBytes(bytes, Uint8Array.from([0x1b, 0x2a, 33, 0x80, 0x01])), true)
  assert.equal(includesBytes(bytes, Uint8Array.from([0x1b, 0x74, MTP5_PROFILE.codePage])), false)
})

test('one-copy pending pickup ticket omits empty delivery contact fields but keeps values and payment state', () => {
  const document = fixture({
    type: 'Retirada',
    customer: { name: 'Ana', phone: '', address: '' },
    deliveryFeeCents: 0,
    adjustment: { type: 'none', amountCents: 0, reason: '' },
    payment: { status: 'Pendente', method: '' },
  })
  const bytes = renderEscPos58mm(document, { copies: 1 })

  assert.equal(countBytes(bytes, encodeCp860('CÓPIA 1/1')), 1)
  assert.equal(includesBytes(bytes, encodeCp860('PENDENTE')), true)
  assert.equal(includesBytes(bytes, encodeCp860('Endereço:')), false)
  assert.equal(includesBytes(bytes, encodeCp860('Taxa de entrega')), false)
})

test('one consolidated pre-account renders canonical lines and total without order copy labels', () => {
  const bytes = renderEscPos58mm(tableTabFixture, { copies: 1 })

  for (const value of [
    'Restaurante A',
    'PR\u00c9-CONTA',
    'COMANDA #1042',
    'Mesa 1',
    '2x X-Bacon Grande',
    '1x X-Bacon Grande',
    'Sem cebola',
    '1x Suco 500 ml',
    'Sem gelo',
    'TOTAL R$ 86,00',
    'N\u00c3O \u00c9 COMPROVANTE DE',
    'PAGAMENTO',
  ]) assert.equal(includesBytes(bytes, encodeCp860(value)), true, value)

  assert.equal(countBytes(bytes, encodeCp860('PR\u00c9-CONTA')), 2, 'title and warning each contain PRE-CONTA once')
  assert.equal(includesBytes(bytes, encodeCp860('PEDIDO #')), false)
  assert.equal(includesBytes(bytes, encodeCp860('C\u00d3PIA')), false)
})

test('table-tab rendering is exactly one copy while order and test contracts stay unchanged', () => {
  assert.throws(() => renderEscPos58mm(tableTabFixture, { copies: 2 }), /one copy/i)

  const orderBytes = renderEscPos58mm(fixture(), { copies: 2 })
  assert.equal(countBytes(orderBytes, encodeCp860('C\u00d3PIA 1/2')), 1)
  assert.equal(countBytes(orderBytes, encodeCp860('C\u00d3PIA 2/2')), 1)

  const testBytes = renderEscPos58mm({ type: 'test', business: { name: 'Loja' }, test: { title: 'TESTE', message: 'OK' } }, { copies: 1 })
  assert.equal(includesBytes(testBytes, encodeCp860('TESTE')), true)
  assert.equal(includesBytes(testBytes, encodeCp860('COMANDA')), false)
})
