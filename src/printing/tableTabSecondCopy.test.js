import test from 'node:test'
import assert from 'node:assert/strict'
import { runClaimedPrintJob } from '../domains/printing/application/printJobRunner.js'
import {
  getSecondCopyPromptTitle,
  isSecondCopyPromptEligible,
  renderEscPos58mm,
} from '../domains/printing/index.js'

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

for (const scenario of [
  { name: '1/1', copiesRequested: 1, copiesPrinted: 0, expectedCopy: 1 },
  { name: '1/2', copiesRequested: 2, copiesPrinted: 0, expectedCopy: 1 },
  { name: '2/2', copiesRequested: 2, copiesPrinted: 1, expectedCopy: 2 },
]) {
  test(`the alternate runner renders comanda ${scenario.name} once through the real renderer`, async () => {
    const events = []
    const result = await runClaimedPrintJob({
      job: { ...awaitingTab, copiesRequested: scenario.copiesRequested, copiesPrinted: scenario.copiesPrinted },
      stationId: 'kitchen',
      port: 'COM1',
      renderer: renderEscPos58mm,
      transport: async (port, bytes) => events.push(['transport', port, bytes.length > 0]),
      completeJob: async (...args) => events.push(['complete', ...args]),
      failJob: async (...args) => events.push(['fail', ...args]),
    })

    assert.equal(result.status, 'printed')
    assert.deepEqual(events, [
      ['transport', 'COM1', true],
      ['complete', 'job-tab', 'kitchen', scenario.expectedCopy],
    ])
  })
}
