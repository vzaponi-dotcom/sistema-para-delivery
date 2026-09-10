import assert from 'node:assert/strict'
import test from 'node:test'
import { createTableTabPrintDocument, TABLE_TAB_PRINT_DOCUMENT_VERSION } from './tableTabPrintDocument.js'

const emittedAt = '2026-09-10T20:00:00.000Z'
const createDetail = () => ({
  id: 'tab-uuid-not-the-number', number: 1042, status: 'open',
  openedAt: '2026-09-10T18:00:00.000Z', businessName: 'Restaurante A',
  table: { id: 'table-1', name: 'Mesa 1' }, orderCount: 2, itemCount: 4, totalCents: 8600,
  items: [
    { productId: 'burger', name: 'X-Bacon', presentation: 'Grande', note: '', unitPriceCents: 2200, quantity: 3, lineTotalCents: 6600 },
    { productId: 'burger', name: 'X-Bacon', presentation: 'Grande', note: 'Sem cebola', unitPriceCents: 2200, quantity: 1, lineTotalCents: 2200 },
  ],
})

test('canonical document preserves the pending pre-account snapshot and authoritative payable total', () => {
  const detail = createDetail()
  const document = createTableTabPrintDocument(detail, emittedAt)
  assert.deepEqual(document, {
    version: 1, type: 'table-tab', business: { name: 'Restaurante A' },
    tableTab: { id: 'tab-uuid-not-the-number', number: 1042, tableName: 'Mesa 1',
      openedAt: '2026-09-10T18:00:00.000Z', emittedAt },
    items: [
      { productId: 'burger', name: 'X-Bacon', presentation: 'Grande', note: '', unitPriceCents: 2200, quantity: 3, lineTotalCents: 6600 },
      { productId: 'burger', name: 'X-Bacon', presentation: 'Grande', note: 'Sem cebola', unitPriceCents: 2200, quantity: 1, lineTotalCents: 2200 },
    ],
    financial: { totalCents: 8600 }, payment: { status: 'Pendente', method: '' },
    message: 'PRÉ-CONTA — NÃO É COMPROVANTE DE PAGAMENTO',
  })
  assert.equal(document.version, TABLE_TAB_PRINT_DOCUMENT_VERSION)
})

test('repeated canonical documents are independent snapshots without mutating or regrouping detail', () => {
  const detail = createDetail()
  const original = structuredClone(detail)
  const first = createTableTabPrintDocument(detail, emittedAt)
  const second = createTableTabPrintDocument(detail, emittedAt)
  assert.deepEqual(first, second)
  assert.deepEqual(detail, original)
  first.items[0].quantity = 99
  first.items.push({ name: 'Extra' })
  first.tableTab.tableName = 'Changed'
  assert.deepEqual(detail, original)
  assert.equal(second.items[0].quantity, 3)
  assert.equal(second.items.length, 2)
  detail.items[1].note = 'Changed after emission'
  assert.equal(second.items[1].note, 'Sem cebola')
})

test('empty canonical documents apply display defaults and generate an ISO emission time', () => {
  const before = Date.now()
  const document = createTableTabPrintDocument({ id: 7, number: '1042', items: [], totalCents: '0' })
  const after = Date.now()
  assert.deepEqual(document.business, { name: 'Amor & Sabor' })
  assert.equal(document.tableTab.id, '7')
  assert.equal(document.tableTab.number, 1042)
  assert.equal(document.tableTab.tableName, '')
  assert.equal(document.tableTab.openedAt, '')
  assert.deepEqual(document.items, [])
  assert.deepEqual(document.financial, { totalCents: 0 })
  const timestamp = Date.parse(document.tableTab.emittedAt)
  assert.ok(timestamp >= before && timestamp <= after)
  assert.equal(new Date(timestamp).toISOString(), document.tableTab.emittedAt)
})
