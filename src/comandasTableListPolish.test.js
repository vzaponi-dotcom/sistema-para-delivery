import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { workspaceHarness, nodeText } from './test-support/renderWorkspace.js'

const css = fs.readFileSync(new URL('./comandas.css', import.meta.url), 'utf8')

const tables = [
  {
    id: 'mesa-1',
    name: 'Mesa 1',
    isActive: true,
    sortOrder: 1,
    occupancy: 'occupied',
    openTableTab: { id: 'tab-30', number: 30, itemCount: 5, totalCents: 9350 },
  },
  {
    id: 'mesa-4',
    name: 'Mesa 4',
    isActive: true,
    sortOrder: 2,
    occupancy: 'free',
    openTableTab: null,
  },
]

test('Comandas list uses one centered table icon without repeating the table number', async (t) => {
  const h = await workspaceHarness(t, { mobile: true })
  const { default: Comandas } = await h.load('/src/domains/table-service/ui/Comandas.jsx')
  const r = await h.render(Comandas, { tables, currency: (value) => `R$ ${value.toFixed(2)}` })
  const list = r.root.findByProps({ 'aria-label': 'Mesas ativas' })
  const buttons = list.findAllByType('button')

  assert.equal(buttons.length, 2)
  for (const button of buttons) {
    const iconCell = button.findByProps({ className: 'comanda-table-icon' })
    assert.ok(iconCell.findByType('svg'), 'table icon must be rendered inside the visual slot')
    assert.equal(nodeText(iconCell), '', 'the icon slot must not repeat the table number')
  }
  assert.match(nodeText(buttons[0]), /Mesa 1.*Ocupada.*Comanda 30.*5 itens.*R\$ 93\.50/)
  assert.match(nodeText(buttons[1]), /Mesa 4.*Livre.*Toque para lançar pedido/)
})

test('Comandas list keeps occupied cards richer and free cards shorter with aligned status and totals', async (t) => {
  const h = await workspaceHarness(t, { mobile: true })
  const { default: Comandas } = await h.load('/src/domains/table-service/ui/Comandas.jsx')
  const r = await h.render(Comandas, { tables, currency: (value) => `R$ ${value.toFixed(2)}` })
  const [occupied, free] = r.root.findByProps({ 'aria-label': 'Mesas ativas' }).findAllByType('button')

  assert.match(occupied.props.className, /is-occupied/)
  assert.match(free.props.className, /is-free/)
  assert.ok(occupied.findByProps({ className: 'comanda-table-total' }))
  assert.equal(free.findAllByProps({ className: 'comanda-table-total' }).length, 0)

  assert.match(css, /\.comanda-table-icon\s*\{[^}]*display:\s*grid;[^}]*place-items:\s*center;/s)
  assert.match(css, /\.comanda-table-button\.is-occupied\s*\{[^}]*min-height:\s*96px;/s)
  assert.match(css, /\.comanda-table-button\.is-free\s*\{[^}]*min-height:\s*72px;/s)
  assert.match(css, /\.comanda-status\.occupied\s*\{[^}]*background:\s*var\(--primary-soft\);[^}]*color:\s*var\(--primary\);/s)
})

test('Mesiva uses warning semantics for occupied badges without changing selection accents', () => {
  assert.match(
    css,
    /:root\[data-visual-theme=['"]mesiva['"]\] \.comanda-status\.occupied\s*\{[^}]*background:\s*var\(--warning-soft\);[^}]*color:\s*var\(--warning\);/s,
  )
  assert.match(
    css,
    /:root\[data-visual-theme=['"]mesiva['"]\] \.comanda-detail-status-chip:not\(\.is-closed\)\s*\{[^}]*background:\s*var\(--warning-soft\);[^}]*border-color:\s*var\(--warning\);[^}]*color:\s*var\(--warning\);/s,
  )
  assert.match(css, /\.comanda-table-button\[aria-pressed=['"]true['"]\]\s*\{[^}]*border-color:\s*var\(--primary\);[^}]*background:\s*var\(--primary-soft\);/s)
})
