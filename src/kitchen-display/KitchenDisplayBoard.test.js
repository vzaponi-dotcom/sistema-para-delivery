import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { nodeText, workspaceHarness } from '../test-support/renderWorkspace.js'

const timing = { scheduledPrepLeadMinutes: 50, scheduledLateGraceMinutes: 15, immediateLateAfterMinutes: 30, immediateVeryLateAfterMinutes: 60 }

test('board renders normative header, six-card ceiling, overflow and empty state', async (t) => {
  const h = await workspaceHarness(t)
  const { KitchenDisplayBoard } = await h.load('/src/kitchen-display/KitchenDisplayBoard.jsx')
  const orders = Array.from({ length: 7 }, (_, index) => ({
    id: `order-${index}`, orderNumber: 1040 + index, client: `Cliente ${index}`, type: 'Entrega', status: 'Em preparo', createdAt: '2026-09-22T19:50:00.000Z', items: [],
  }))
  const now = new Date('2026-09-22T20:00:00.000Z')
  const renderer = await h.render(KitchenDisplayBoard, { orders, timing, now, highlightedIds: new Set() })
  const text = nodeText(renderer.root)
  assert.match(text, /Cozinha/)
  assert.match(text, /Boas refeições\. Mais histórias\./)
  assert.match(text, /Em preparo7/)
  assert.match(text, /Atrasados0/)
  assert.match(text, /Agendados0/)
  assert.match(text, /\+ 1 pedido fora da tela/)
  assert.equal(renderer.root.findAll((node) => String(node.props?.className || '').split(' ').includes('kds-card')).length, 6)

  const empty = await h.render(KitchenDisplayBoard, { orders: [], timing, now, highlightedIds: new Set() })
  assert.match(nodeText(empty.root), /Nenhum pedido aguardando preparo\./)
})

test('CSS fixes a 3x2 dark board, Inter typography, 720p contract and no page scroll', async () => {
  const css = await readFile(new URL('./kitchen-display.css', import.meta.url), 'utf8')
  assert.match(css, /--kds-bg:\s*#[0-9a-f]{6}/i)
  assert.match(css, /font-family:\s*Inter/i)
  assert.match(css, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/)
  assert.match(css, /grid-template-rows:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/)
  assert.match(css, /overflow:\s*hidden/)
  assert.match(css, /@media\s*\([^)]*max-height:\s*720px/)
  assert.doesNotMatch(css, /var\(--(?:color|theme|surface)-/)
})
