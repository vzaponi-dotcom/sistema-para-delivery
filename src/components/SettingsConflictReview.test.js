import assert from 'node:assert/strict'
import test from 'node:test'
import { act } from 'react-test-renderer'
import { readFile } from 'node:fs/promises'

import { buildSettingsConflict } from '../app/settingsConflict.js'
import { buttonNamed, nodeText, workspaceHarness } from '../test-support/renderWorkspace.js'
import { adminFixture } from '../test-support/settingsFixtures.js'

test('operation review renders only friendly field differences without raw JSON', async (t) => {
  const h = await workspaceHarness(t)
  const { default: SettingsConflictReview } = await h.load('/src/components/SettingsConflictReview.jsx')
  const base = structuredClone(adminFixture.data)
  const current = structuredClone(base)
  const draft = structuredClone(base)
  const timingKeys = Object.keys(base.timing)
  timingKeys.forEach((key) => {
    current.timing[key] = base.timing[key] + 1
    draft.timing[key] = base.timing[key] + 2
  })
  current.enabledModalities = ['Entrega']
  draft.enabledModalities = ['Retirada', 'Local']
  current.defaultModality = 'Local'
  draft.defaultModality = 'Retirada'
  const review = { ...buildSettingsConflict({ base, current, draft }), resource: 'operations' }
  const renderer = await h.render(SettingsConflictReview, { review, onAccept() {}, onClose() {} })
  const content = nodeText(renderer.root)

  for (const label of [
    'Preparo antecipado do agendado',
    'Tolerância de atraso do agendado',
    'Pedido imediato fica atrasado',
    'Pedido imediato fica muito atrasado',
    'Modalidades ativas',
    'Modalidade padrão',
  ]) assert.match(content, new RegExp(label))
  assert.match(content, /Atual no neg[oó]cio/)
  assert.match(content, /Seu ajuste/)
  assert.match(content, /min/)
  assert.match(content, /Retirada, Local/)
  assert.doesNotMatch(content, /\{"timing"|scheduledPrepLeadMinutes|enabledModalities/)
  assert.equal(renderer.root.findAllByType('fieldset').length, 6)
  assert.match(renderer.root.findByProps({ className: 'modal-card settings-conflict-modal' }).props.className, /settings-conflict-modal/)
})

test('a single operation difference is the only review card and receives initial focus', async (t) => {
  const h = await workspaceHarness(t)
  const { default: SettingsConflictReview } = await h.load('/src/components/SettingsConflictReview.jsx')
  const base = structuredClone(adminFixture.data)
  const current = structuredClone(base)
  const draft = structuredClone(base)
  current.timing.scheduledPrepLeadMinutes += 1
  draft.timing.scheduledPrepLeadMinutes += 2
  const review = { ...buildSettingsConflict({ base, current, draft }), resource: 'operations' }
  const renderer = await h.render(SettingsConflictReview, { review, onAccept() {}, onClose() {} })

  assert.equal(renderer.root.findAllByType('fieldset').length, 1)
  assert.equal(renderer.root.findAllByProps({ 'data-operation-conflict': 'timing.scheduledPrepLeadMinutes' }).length, 1)
  assert.equal(renderer.root.findByProps({ className: 'modal-card settings-conflict-modal' }).props['data-initial-focus'], '.settings-conflict-choice input')
})

test('operation conflict modal contains long values without horizontal overflow', async () => {
  const css = await readFile(new URL('../settings.css', import.meta.url), 'utf8')
  assert.match(css, /\.settings-conflict-modal\s*\{[^}]*width:\s*min\(760px, 100%\)[^}]*max-width:\s*100%/s)
  assert.match(css, /\.settings-conflict-review\.is-operations\s*\{[^}]*min-width:\s*0[^}]*overflow-x:\s*hidden/s)
  assert.match(css, /\.settings-conflict-choices\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/s)
  assert.match(css, /\.settings-conflict-value\s*\{[^}]*overflow-wrap:\s*anywhere/s)
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.settings-conflict-choices\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s)
})

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

test('primary station conflict stays human-readable and preserves the selected station id', async (t) => {
  const h = await workspaceHarness(t)
  const { default: SettingsConflictReview } = await h.load('/src/components/SettingsConflictReview.jsx')
  const accepted = []
  const review = {
    ...buildSettingsConflict({
      base: { primaryStationId: 'station-base' },
      current: { primaryStationId: 'station-remote' },
      draft: { primaryStationId: 'station-local' },
    }),
    resource: 'stationPrimary',
  }
  const renderer = await h.render(SettingsConflictReview, {
    review,
    onAccept: (value) => accepted.push(value),
    onClose() {},
  })
  const content = nodeText(renderer.root)

  assert.match(content, /Estação principal/)
  assert.match(content, /Outra estação foi definida como principal enquanto você editava/)
  assert.match(content, /Manter a estação principal atual/)
  assert.match(content, /Tornar esta estação a principal/)
  assert.doesNotMatch(content, /primaryStationId|station-base|station-remote|station-local|\{"primaryStationId"/)
  assert.match(renderer.root.findByProps({ className: 'modal-card settings-conflict-modal' }).props.className, /settings-conflict-modal/)

  const local = renderer.root.findByProps({ 'aria-label': 'Tornar esta estação a principal' })
  await act(async () => local.props.onChange())
  await act(async () => buttonNamed(renderer.root, 'Aplicar revisão').props.onClick())
  assert.deepEqual(accepted, [{ primaryStationId: 'station-local' }])
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
