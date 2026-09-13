import test from 'node:test'
import assert from 'node:assert/strict'
import { resolvePrintCopies } from './printContextPolicy.js'

const policy = Object.freeze({ orderDefaultCopies: 2, tableTabDefaultCopies: 1 })

test('commercial defaults follow durable print context, never the Local label alone', () => {
  assert.equal(resolvePrintCopies({ jobType: 'order', policy }), 2)
  assert.equal(resolvePrintCopies({ jobType: 'order', customerIdentityType: 'guest_name', policy }), 2)
  assert.equal(resolvePrintCopies({ jobType: 'order', customerIdentityType: 'table', policy }), 1)
  assert.equal(resolvePrintCopies({ jobType: 'order', tableTabId: 'tab-1', policy }), 1)
  assert.equal(resolvePrintCopies({ jobType: 'table-tab', policy }), 1)
  assert.equal(resolvePrintCopies({ jobType: 'order', modality: 'Local', policy }), 2)
})

test('an explicit valid commercial copy count wins over the context default', () => {
  assert.equal(resolvePrintCopies({ jobType: 'order', explicitCopies: 1, policy }), 1)
  assert.equal(resolvePrintCopies({ jobType: 'table-tab', explicitCopies: 2, policy }), 2)
})

test('explicit invalid values fail closed instead of falling back to policy', () => {
  for (const explicitCopies of [null, 0, 3, -1, 1.5, '1', '2', true, {}, []]) {
    assert.throws(
      () => resolvePrintCopies({ jobType: 'order', explicitCopies, policy }),
      { status: 400, code: 'INVALID_PRINT_COPIES' },
    )
  }
})

test('test jobs are always a single copy and policy input stays strictly validated', () => {
  assert.equal(resolvePrintCopies({ jobType: 'test', explicitCopies: 2, policy }), 1)
  assert.throws(
    () => resolvePrintCopies({ jobType: 'order', policy: { ...policy, extra: true } }),
    { status: 400, code: 'SETTINGS_INVALID' },
  )
})
