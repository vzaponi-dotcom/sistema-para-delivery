import assert from 'node:assert/strict'
import test from 'node:test'

import { buildSettingsConflict } from '../app/settingsConflict.js'
import { nodeText, workspaceHarness } from '../test-support/renderWorkspace.js'

const item = (id, label, extra = {}) => ({ id, label, active: true, sortOrder: 0, ...extra })

test('cancellation conflicts use business labels and never expose paths or raw JSON', async (t) => {
  const h = await workspaceHarness(t)
  const { default: SettingsConflictReview } = await h.load('/src/components/SettingsConflictReview.jsx')
  const base = { items: [item('reason-one', 'Cliente desistiu')] }
  const current = { items: [item('reason-one', 'Cliente cancelou')] }
  const draft = { items: [item('reason-one', 'Cliente pediu cancelamento')] }
  const review = { ...buildSettingsConflict({ base, current, draft }), resource: 'cancellationReasons' }
  const renderer = await h.render(SettingsConflictReview, { review, onAccept() {}, onClose() {} })
  const content = nodeText(renderer.root)

  assert.match(content, /Motivo [“"]Cliente desistiu[”"] — Nome/)
  assert.match(content, /Cliente cancelou/)
  assert.match(content, /Cliente pediu cancelamento/)
  assert.doesNotMatch(content, /items\[reason-one\]\.label|reason-one|\{"items"/)
})

test('finance category conflicts reuse the same friendly review structure', async (t) => {
  const h = await workspaceHarness(t)
  const { default: SettingsConflictReview } = await h.load('/src/components/SettingsConflictReview.jsx')
  const base = { items: [item('packaging', 'Embalagens', { type: 'saida' })] }
  const current = { items: [item('packaging', 'Material de embalagem', { type: 'saida' })] }
  const draft = { items: [item('packaging', 'Embalagens delivery', { type: 'saida' })] }
  const review = { ...buildSettingsConflict({ base, current, draft }), resource: 'financeCategories' }
  const renderer = await h.render(SettingsConflictReview, { review, onAccept() {}, onClose() {} })
  const content = nodeText(renderer.root)

  assert.match(content, /Categoria [“"]Embalagens[”"] — Nome/)
  assert.match(content, /Material de embalagem/)
  assert.match(content, /Embalagens delivery/)
  assert.doesNotMatch(content, /items\[packaging\]\.label|\{"items"/)
})

test('cancellation order conflicts translate ids into reason names', async (t) => {
  const h = await workspaceHarness(t)
  const { default: SettingsConflictReview } = await h.load('/src/components/SettingsConflictReview.jsx')
  const first = item('reason-a', 'Primeiro', { sortOrder: 0 })
  const second = item('reason-b', 'Segundo', { sortOrder: 1 })
  const third = item('reason-c', 'Terceiro', { sortOrder: 2 })
  const base = { items: [first, second, third] }
  const current = { items: [{ ...second, sortOrder: 0 }, { ...first, sortOrder: 1 }, third] }
  const draft = { items: [first, { ...third, sortOrder: 1 }, { ...second, sortOrder: 2 }] }
  const review = { ...buildSettingsConflict({ base, current, draft }), resource: 'cancellationReasons' }
  const renderer = await h.render(SettingsConflictReview, { review, onAccept() {}, onClose() {} })
  const content = nodeText(renderer.root)

  assert.match(content, /Ordem dos motivos de cancelamento/)
  assert.match(content, /Segundo → Primeiro → Terceiro/)
  assert.match(content, /Primeiro → Terceiro → Segundo/)
  assert.doesNotMatch(content, /reason-a|reason-b|reason-c/)
})

test('payment method list conflicts remain readable without object serialization', async (t) => {
  const h = await workspaceHarness(t)
  const { default: SettingsConflictReview } = await h.load('/src/components/SettingsConflictReview.jsx')
  const pix = { code: 'pix', active: true, sortOrder: 0 }
  const cash = { code: 'cash', active: true, sortOrder: 1 }
  const base = { methods: [pix, cash], defaultMethod: 'pix' }
  const current = { methods: [{ ...cash, sortOrder: 0 }, { ...pix, sortOrder: 1 }], defaultMethod: 'pix' }
  const draft = { methods: [{ ...pix, active: false }, cash], defaultMethod: 'cash' }
  const review = { ...buildSettingsConflict({ base, current, draft }), resource: 'paymentMethods' }
  const renderer = await h.render(SettingsConflictReview, { review, onAccept() {}, onClose() {} })
  const content = nodeText(renderer.root)

  assert.match(content, /Formas de pagamento/)
  assert.match(content, /Pix/)
  assert.match(content, /Dinheiro/)
  assert.match(content, /Inativo/)
  assert.doesNotMatch(content, /\[object Object\]|\{"methods"|"code"|methods/)
})

test('a compatible merge never serializes unknown setting objects', async (t) => {
  const h = await workspaceHarness(t)
  const { default: SettingsConflictReview } = await h.load('/src/components/SettingsConflictReview.jsx')
  const review = {
    ...buildSettingsConflict({
      base: { group: { first: 1, second: 1 } },
      current: { group: { first: 2, second: 1 } },
      draft: { group: { first: 1, second: 2 } },
    }),
    resource: 'futureSettingsResource',
  }
  const renderer = await h.render(SettingsConflictReview, { review, onAccept() {}, onClose() {} })
  const content = nodeText(renderer.root)

  assert.match(content, /Alterações compatíveis/)
  assert.match(content, /podem ser combinadas automaticamente/)
  assert.doesNotMatch(content, /Atual no neg[oó]cio|Seu ajuste|\{"group"|"first"|futureSettingsResource/)
})
