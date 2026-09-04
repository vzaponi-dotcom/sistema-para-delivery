import test from 'node:test'
import assert from 'node:assert/strict'
import { createOrderPrintDocument } from '../../shared/orderPrintDocument.js'
import { getOrderPdfFilename, renderOrderPdf } from './pdfOrderRenderer.js'

const document = createOrderPrintDocument({
  businessName: 'Amor & Sabor',
  orderId: 'order-0184',
  type: 'Entrega',
  createdAt: '2026-09-03T20:15:00.000Z',
  customer: {
    name: 'João da Silva',
    phone: '(11) 99876-5432',
    address: 'Rua das Flores, 123',
  },
  items: [
    { name: 'X-Burger', presentation: 'G', quantity: 2, unitPriceCents: 2500, note: 'Sem cebola' },
    { name: 'Coca-Cola', presentation: '350ml', quantity: 1, unitPriceCents: 800, note: '' },
  ],
  subtotalCents: 5800,
  deliveryFeeCents: 800,
  adjustment: { type: 'discount', amountCents: 300, reason: 'Fidelidade' },
  totalCents: 6300,
  payment: { status: 'Pago', method: 'Pix' },
})

class FakePdf {
  constructor(options) {
    this.options = options
    this.writes = []
    this.y = 0
    this.internal = { pageSize: { getHeight: () => 210, getWidth: () => 148 } }
  }
  setFont() {}
  setFontSize() {}
  setTextColor() {}
  setLineWidth() {}
  text(value, x, y) { this.writes.push(String(value)); this.y = y }
  line() {}
  addPage() {}
  splitTextToSize(value) { return [String(value)] }
  output(type) {
    assert.equal(type, 'arraybuffer')
    return new TextEncoder().encode('%PDF-1.7\nFAKE').buffer
  }
}

test('PDF filename is stable and uses the friendly order number', () => {
  assert.equal(getOrderPdfFilename(document), 'pedido-0184.pdf')
})

test('A5 PDF is text-native and contains the same customer-safe ticket semantics', () => {
  let instance
  const bytes = renderOrderPdf(document, {
    jsPDFFactory: (options) => {
      instance = new FakePdf(options)
      return instance
    },
  })

  assert.ok(bytes instanceof ArrayBuffer)
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), '%PDF-')
  assert.deepEqual(instance.options, { orientation: 'portrait', unit: 'mm', format: 'a5' })

  const text = instance.writes.join('\n')
  for (const expected of [
    'Amor & Sabor',
    'PEDIDO #0184',
    'João da Silva',
    '2x X-Burger G',
    'Sem cebola',
    'TOTAL R$ 63,00',
    'Pagamento: PAGO - Pix',
    'Obrigado pela compra! Agradecemos a preferência.',
  ]) assert.match(text, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))

  assert.doesNotMatch(text, /CÓPIA\s+\d\/\d/)
})
