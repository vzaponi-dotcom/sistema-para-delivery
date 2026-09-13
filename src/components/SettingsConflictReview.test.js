import assert from 'node:assert/strict'
import test from 'node:test'
import { act } from 'react-test-renderer'

import { buildSettingsConflict } from '../app/settingsConflict.js'
import { buttonNamed, nodeText, workspaceHarness } from '../test-support/renderWorkspace.js'

test('review without collisions still waits for an explicit click and never saves', async (t) => {
  const h = await workspaceHarness(t)
  const { default: SettingsConflictReview } = await h.load('/src/components/SettingsConflictReview.jsx')
  const accepted = []
  let writes = 0
  const review = buildSettingsConflict({
    base: { late: 30, grace: 15 },
    draft: { late: 25, grace: 15 },
    current: { late: 30, grace: 10 },
  })
  const renderer = await h.render(SettingsConflictReview, {
    review,
    onAccept: (candidate) => { accepted.push(candidate) },
    onSave: () => { writes += 1 },
    onClose() {},
  })

  assert.equal(accepted.length, 0)
  assert.equal(writes, 0)
  assert.match(nodeText(renderer.root), /Atual no neg[oó]cio/)
  assert.match(nodeText(renderer.root), /Seu ajuste/)
  assert.match(nodeText(renderer.root), /Escolha para salvar/)
  await act(async () => buttonNamed(renderer.root, 'Aplicar revisão').props.onClick())
  assert.deepEqual(accepted, [{ late: 25, grace: 10 }])
  assert.equal(writes, 0)
})

test('a real collision has no destructive default and applies the selected side', async (t) => {
  const h = await workspaceHarness(t)
  const { default: SettingsConflictReview } = await h.load('/src/components/SettingsConflictReview.jsx')
  const accepted = []
  const review = buildSettingsConflict({ base: { late: 30 }, draft: { late: 25 }, current: { late: 35 } })
  const renderer = await h.render(SettingsConflictReview, { review, onAccept: (value) => accepted.push(value), onClose() {} })
  const apply = () => buttonNamed(renderer.root, 'Aplicar revisão')

  assert.equal(apply().props.disabled, true)
  const local = renderer.root.findByProps({ 'aria-label': 'Usar seu ajuste para late' })
  await act(async () => local.props.onChange())
  assert.equal(apply().props.disabled, false)
  await act(async () => apply().props.onClick())
  assert.deepEqual(accepted, [{ late: 25 }])
})

test('a newly protected item explains the change and does not offer the illegal draft action', async (t) => {
  const h = await workspaceHarness(t)
  const { default: SettingsConflictReview } = await h.load('/src/components/SettingsConflictReview.jsx')
  const item = { id: 'custom', label: 'Personalizado', active: true, sortOrder: 0 }
  const review = buildSettingsConflict({
    base: { data: { items: [item] }, revision: 1, meta: { items: { custom: { canRename: true, canDelete: true } } } },
    draft: { items: [] },
    current: { data: { items: [item] }, revision: 2, meta: { items: { custom: { usedEver: true, canRename: false, canDelete: false } } } },
  })
  const renderer = await h.render(SettingsConflictReview, { review, onAccept() {}, onClose() {} })

  assert.match(nodeText(renderer.root), /estado atual do neg[oó]cio mudou|primeiro uso/i)
  assert.equal(renderer.root.findAll((node) => node.type === 'input' && node.props['aria-label']?.startsWith('Usar seu ajuste')).length, 0)
  assert.equal(buttonNamed(renderer.root, 'Aplicar revisão').props.disabled, false)
})

test('double click accepts one review decision while the first callback is pending', async (t) => {
  const h = await workspaceHarness(t)
  const { default: SettingsConflictReview } = await h.load('/src/components/SettingsConflictReview.jsx')
  let releases
  let calls = 0
  const pending = new Promise((resolve) => { releases = resolve })
  const review = buildSettingsConflict({ base: { late: 30 }, draft: { late: 25 }, current: { late: 30 } })
  const renderer = await h.render(SettingsConflictReview, { review, onAccept: async () => { calls += 1; await pending }, onClose() {} })
  const apply = buttonNamed(renderer.root, 'Aplicar revisão')

  let first
  await act(async () => {
    first = apply.props.onClick()
    void apply.props.onClick()
    await Promise.resolve()
  })
  assert.equal(calls, 1)
  releases()
  await act(async () => first)
})
