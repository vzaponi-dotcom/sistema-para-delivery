import assert from 'node:assert/strict'
import test from 'node:test'

import { buildSettingsConflict, resolveSettingsConflict } from './settingsConflict.js'

test('three-way merge keeps remote-only and local-only changes and accepts the same change', () => {
  const review = buildSettingsConflict({
    base: { late: 30, grace: 15, defaultMode: 'delivery' },
    draft: { late: 25, grace: 15, defaultMode: 'pickup' },
    current: { late: 30, grace: 10, defaultMode: 'pickup' },
  })

  assert.deepEqual(review.candidate, { late: 25, grace: 10, defaultMode: 'pickup' })
  assert.deepEqual(review.conflicts, [])
})

test('different changes on both sides remain explicit and unresolved', () => {
  const review = buildSettingsConflict({
    base: { late: 30 },
    draft: { late: 25 },
    current: { late: 35 },
  })

  assert.equal(review.conflicts.length, 1)
  assert.equal(review.conflicts[0].path, 'late')
  assert.deepEqual(review.conflicts[0].choices, ['current', 'draft'])
  assert.equal(review.conflicts[0].choice, null)
  assert.deepEqual(review.candidate, { late: 35 })
  assert.deepEqual(resolveSettingsConflict(review, { [review.conflicts[0].id]: 'draft' }), { late: 25 })
})

test('stable item identity merges a local reorder with a remote item edit', () => {
  const base = { items: [
    { id: 'a', label: 'A', active: true, sortOrder: 0 },
    { id: 'b', label: 'B', active: true, sortOrder: 1 },
  ] }
  const review = buildSettingsConflict({
    base,
    draft: { items: [base.items[1], base.items[0]] },
    current: { items: [{ ...base.items[0], label: 'A atual' }, base.items[1]] },
  })

  assert.deepEqual(review.candidate.items.map(({ id }) => id), ['b', 'a'])
  assert.equal(review.candidate.items.find(({ id }) => id === 'a').label, 'A atual')
  assert.deepEqual(review.candidate.items.map(({ sortOrder }) => sortOrder), [0, 1])
  assert.deepEqual(review.conflicts, [])
})

test('different reorders are compared as one list instead of by index', () => {
  const items = ['a', 'b', 'c'].map((id, sortOrder) => ({ id, label: id.toUpperCase(), sortOrder }))
  const review = buildSettingsConflict({
    base: { items },
    draft: { items: [items[1], items[0], items[2]] },
    current: { items: [items[0], items[2], items[1]] },
  })
  const order = review.conflicts.find(({ kind }) => kind === 'order')

  assert.ok(order)
  assert.deepEqual(order.base, ['a', 'b', 'c'])
  assert.deepEqual(order.current, ['a', 'c', 'b'])
  assert.deepEqual(order.draft, ['b', 'a', 'c'])
  assert.deepEqual(resolveSettingsConflict(review, { [order.id]: 'draft' }).items.map(({ id }) => id), ['b', 'a', 'c'])
})

test('delete versus edit is a conflict resolved by stable item id', () => {
  const a = { id: 'a', label: 'A', active: true, sortOrder: 0 }
  const b = { id: 'b', label: 'B', active: true, sortOrder: 1 }
  const review = buildSettingsConflict({
    base: { items: [a, b] },
    draft: { items: [b] },
    current: { items: [{ ...a, label: 'A atual' }, b] },
  })
  const conflict = review.conflicts.find(({ kind }) => kind === 'delete-edit')

  assert.equal(conflict.itemId, 'a')
  assert.equal(review.candidate.items.some(({ id }) => id === 'a'), true)
  assert.equal(resolveSettingsConflict(review, { [conflict.id]: 'draft' }).items.some(({ id }) => id === 'a'), false)
})

test('independent deletion and remote addition do not become a false reorder conflict', () => {
  const a = { id: 'a', label: 'A', sortOrder: 0 }
  const b = { id: 'b', label: 'B', sortOrder: 1 }
  const c = { id: 'c', label: 'C', sortOrder: 2 }
  const review = buildSettingsConflict({
    base: { items: [a, b] },
    draft: { items: [b] },
    current: { items: [a, b, c] },
  })

  assert.equal(review.conflicts.some(({ kind }) => kind === 'order'), false)
  assert.deepEqual(review.candidate.items.map(({ id }) => id), ['b', 'c'])
})

test('first use removes a now-illegal rename or delete choice and preserves history', () => {
  const item = { id: 'custom', label: 'Personalizado', active: true, sortOrder: 0 }
  const base = { data: { items: [item] }, revision: 1, meta: { items: { custom: { isSystem: false, usedEver: false, canRename: true, canDelete: true } } } }
  const current = { data: { items: [item] }, revision: 2, meta: { items: { custom: { isSystem: false, usedEver: true, canRename: false, canDelete: false } } } }

  for (const draft of [{ items: [] }, { items: [{ ...item, label: 'Novo nome' }] }]) {
    const review = buildSettingsConflict({ base, draft, current })
    const conflict = review.conflicts.find(({ kind }) => kind === 'protected-action')
    assert.ok(conflict)
    assert.deepEqual(conflict.choices, ['current'])
    assert.match(conflict.message, /estado atual do neg[oó]cio mudou|primeiro uso/i)
    assert.deepEqual(review.candidate.items, [item])
  }
})
