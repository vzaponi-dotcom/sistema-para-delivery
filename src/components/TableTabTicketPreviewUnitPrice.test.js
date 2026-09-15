import assert from 'node:assert/strict'
import test from 'node:test'
import { nodeText, workspaceHarness } from '../test-support/renderWorkspace.js'

const document = {
  type: 'table-tab',
  business: { name: 'Restaurante A' },
  tableTab: { id: 'tab-22', number: 22, tableName: 'Mesa 3' },
  items: [
    { name: 'Marmita Frango M', presentation: '', note: '', quantity: 1, unitPriceCents: 2200, lineTotalCents: 2200 },
    { name: 'Marmita Carne G', presentation: '', note: '', quantity: 4, unitPriceCents: 2900, lineTotalCents: 11600 },
  ],
  financial: { totalCents: 13800 },
  message: 'PRE-CONTA - NAO E COMPROVANTE DE PAGAMENTO',
}

test('table-tab preview shows unit price while keeping the authoritative line total', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Preview } = await h.load('/src/components/TableTabTicketPreview.jsx')
  const rendered = await h.render(Preview, { document })
  const text = nodeText(rendered.root).replace(/\u00a0/g, ' ')

  assert.match(text, /Unit\. R\$ 22,00/)
  assert.match(text, /Unit\. R\$ 29,00/)
  assert.match(text, /R\$ 116,00/)
})

test('table-tab preview uses only the header divider before the solid total rule', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Preview } = await h.load('/src/components/TableTabTicketPreview.jsx')
  const rendered = await h.render(Preview, { document })

  assert.equal(rendered.root.findAllByProps({ className: 'order-ticket-divider' }).length, 1)
  assert.ok(rendered.root.findByProps({ className: 'order-ticket-total' }))
})
