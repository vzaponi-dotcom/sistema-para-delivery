import assert from 'node:assert/strict'
import test from 'node:test'
import { createOrderPrintDocument } from '../../shared/orderPrintDocument.js'
import { encodeCp860 } from './cp860.js'
import { renderEscPos58mm, wrapPrintText } from './escpos58mm.js'
import { MTP5_PROFILE } from './mtp5Profile.js'

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

const fixture = (overrides = {}) => createOrderPrintDocument({
  businessName: 'Amor & Sabor',
  orderId: 'order-0184',
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

test('MTP5 profile centralizes physical width, logical columns, code page and serial defaults', () => {
  assert.equal(MTP5_PROFILE.paperWidthMm, 58)
  assert.equal(MTP5_PROFILE.printableWidthMm, 48)
  assert.equal(MTP5_PROFILE.dotsPerLine, 384)
  assert.equal(MTP5_PROFILE.fontAColumns, 32)
  assert.equal(MTP5_PROFILE.codePage, 3)
  assert.equal(MTP5_PROFILE.feedLinesAfterJob, 1)
  assert.deepEqual(MTP5_PROFILE.serial, {
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    flowControl: 'none',
  })
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

test('58mm renderer emits deterministic ESC/POS structure and two approved copies without cut command', () => {
  const bytes = renderEscPos58mm(fixture(), { copies: 2 })

  assert.equal(includesBytes(bytes, Uint8Array.from([0x1b, 0x40])), true)
  assert.equal(includesBytes(bytes, Uint8Array.from([0x1b, 0x74, 0x03])), true)
  assert.equal(includesBytes(bytes, encodeCp860('PEDIDO #0184')), true)
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
  assert.equal(countBytes(bytes, encodeCp860('PEDIDO #0184')), 2)
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
