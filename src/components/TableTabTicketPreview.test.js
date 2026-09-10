import test from 'node:test'
import assert from 'node:assert/strict'
import { workspaceHarness, nodeText } from '../test-support/renderWorkspace.js'

const canonicalDocument = {
  type: 'table-tab',
  business: { name: 'Restaurante A' },
  tableTab: { id: 'tab-1042', number: 1042, tableName: 'Mesa 1' },
  items: [
    { name: 'X-Bacon', presentation: 'Grande', note: '', quantity: 2, lineTotalCents: 4400 },
    { name: 'X-Bacon', presentation: 'Grande', note: 'Sem cebola', quantity: 1, lineTotalCents: 2200 },
  ],
  financial: { totalCents: 8600 },
  message: 'PR\u00c9-CONTA \u2014 N\u00c3O \u00c9 COMPROVANTE DE PAGAMENTO',
}

test('preview faithfully renders every canonical line and authoritative total without regrouping', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Preview } = await h.load('/src/components/TableTabTicketPreview.jsx')
  const r = await h.render(Preview, { document: canonicalDocument })
  const text = nodeText(r.root)

  const normalizedText = text.replace(/\u00a0/g, ' ')
  for (const value of ['Restaurante A', 'PR\u00c9-CONTA', 'COMANDA #1042', 'Mesa 1', '2x X-Bacon Grande', '1x X-Bacon Grande', 'Sem cebola', 'R$ 44,00', 'R$ 22,00', 'R$ 86,00', canonicalDocument.message]) {
    assert.ok(normalizedText.includes(value), value)
  }
  assert.equal(r.root.findAllByProps({ className: 'order-ticket-item' }).length, 2)
  assert.doesNotMatch(text, /PEDIDO #|C\u00d3PIA/)
})

test('preview rejects non table-tab documents', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Preview } = await h.load('/src/components/TableTabTicketPreview.jsx')
  const r = await h.render(Preview, { document: { type: 'order' } })
  assert.equal(r.toJSON(), null)
})
