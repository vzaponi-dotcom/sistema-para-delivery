import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

import * as printing from '../index.js'
import { resolvePrintCopies } from '../../../../shared/printContextPolicy.js'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('Printing public entry owns the three versioned printing policies', () => {
  assert.equal(printing.printingPolicy?.id, 'printingPolicy')
  assert.equal(printing.stationConfigurationPolicy?.id, 'stationConfiguration')
  assert.equal(printing.stationPrimaryPolicy?.id, 'stationPrimary')
})

test('printing policy ownership moves out of the app Settings surface', () => {
  assert.equal(existsSync(new URL('./printingPolicy.js', import.meta.url)), true)
  assert.equal(existsSync(new URL('../../../app/surfaces/settings/policies/printingPolicy.js', import.meta.url)), false)
  const registry = read('../../../app/surfaces/settings/policies/registry.js')
  assert.match(registry, /domains\/printing\/index\.js/)
  assert.doesNotMatch(registry, /\.\/printingPolicy\.js/)
})

test('policy changes affect new contexts without rewriting an existing job snapshot', () => {
  const existing = Object.freeze({ id: 'job-existing', copiesRequested: 2 })
  const changed = Object.freeze({ orderDefaultCopies: 1, tableTabDefaultCopies: 2 })

  assert.equal(resolvePrintCopies({ jobType: 'order', policy: changed }), 1)
  assert.equal(resolvePrintCopies({ jobType: 'order', customerIdentityType: 'table', policy: changed }), 2)
  assert.equal(resolvePrintCopies({ jobType: 'table-tab', policy: changed }), 2)
  assert.equal(existing.copiesRequested, 2)
})
