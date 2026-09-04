import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const preview = await readFile(new URL('./OrderTicketPreview.jsx', import.meta.url), 'utf8')

test('ticket preview consumes only the canonical OrderPrintDocument surface', () => {
  assert.match(preview, /function OrderTicketPreview\(\{ document \}\)/)
  for (const path of [
    'document.business',
    'document.order',
    'document.customer',
    'document.items',
    'document.financial',
    'document.payment',
    'document.message',
  ]) assert.match(preview, new RegExp(path.replace('.', '\\.')))

  assert.doesNotMatch(preview, /\border\.(client|total|paymentStatus|paymentMethod|items)\b/)
})

test('ticket preview keeps the approved customer-safe semantic sections', () => {
  for (const label of ['PEDIDO #', 'Cliente', 'ITENS', 'Subtotal', 'TOTAL', 'Pagamento']) {
    assert.match(preview, new RegExp(label))
  }
  assert.match(preview, /formatPrintMoneyCents/)
  assert.match(preview, /item\.note/)
})
