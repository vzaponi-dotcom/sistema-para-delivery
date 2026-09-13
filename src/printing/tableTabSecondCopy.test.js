import test from 'node:test'
import assert from 'node:assert/strict'
import { getSecondCopyPromptTitle, isSecondCopyPromptEligible } from './secondCopyPromptFlow.js'
import { runClaimedPrintJob } from './printJobRunner.js'

const tabDocument = { version: 1, type: 'table-tab', tableTab: { id: 'tab-17', number: 17, tableName: 'Mesa 7' }, items: [] }
const awaitingTab = {
  id: 'job-tab', type: 'table-tab', tableTabId: 'tab-17', orderId: null,
  status: 'awaiting_second_copy', copiesRequested: 2, copiesPrinted: 1, document: tabDocument,
}

test('the executor prompt recognizes a comanda without inventing an order', () => {
  assert.equal(isSecondCopyPromptEligible(awaitingTab, null), true)
  assert.equal(getSecondCopyPromptTitle(awaitingTab, null), 'Comanda #17')
  assert.equal(isSecondCopyPromptEligible({ ...awaitingTab, type: 'order', orderId: 'order-1' }, null), false)
  assert.equal(isSecondCopyPromptEligible({ ...awaitingTab, status: 'printed' }, null), false)
})

test('the second physical pass renders and completes the same comanda job as copy two', async () => {
  const events = []
  const result = await runClaimedPrintJob({
    job: awaitingTab,
    stationId: 'kitchen',
    port: 'COM1',
    renderer(document, options) { events.push(['render', document, options]); return new Uint8Array([1]) },
    transport: async (port) => events.push(['transport', port]),
    completeJob: async (...args) => events.push(['complete', ...args]),
    failJob: async (...args) => events.push(['fail', ...args]),
  })

  assert.equal(result.status, 'printed')
  assert.deepEqual(events, [
    ['render', tabDocument, { copies: 1, copyNumber: 2, totalCopies: 2 }],
    ['transport', 'COM1'],
    ['complete', 'job-tab', 'kitchen', 2],
  ])
})
