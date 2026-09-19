import test from 'node:test'
import assert from 'node:assert/strict'
import {
  acknowledgeAndOpenSecondCopyPrompt,
  findOriginSecondCopyPrompt,
  getSecondCopyPromptTitle,
  isSecondCopyPromptEligible,
} from './secondCopy.js'

const awaitingSecondCopy = {
  id: 'job-2', orderId: 'order-origin', status: 'awaiting_second_copy',
  copiesRequested: 2, copiesPrinted: 1,
}

test('opens the prompt after acknowledgement refreshes the print queue', async () => {
  const opened = []
  const result = await acknowledgeAndOpenSecondCopyPrompt({
    job: awaitingSecondCopy,
    acknowledge: async () => ({ promptPresented: true }),
    openPrompt: (jobId) => opened.push(jobId),
  })
  assert.deepEqual(result, { promptPresented: true })
  assert.deepEqual(opened, ['job-2'])
})

test('reopens a durable recovery prompt when acknowledgement already exists', async () => {
  const opened = []
  const result = await acknowledgeAndOpenSecondCopyPrompt({
    job: awaitingSecondCopy,
    acknowledge: async () => ({ promptPresented: false }),
    openPrompt: (jobId) => opened.push(jobId),
    reopenAcknowledged: true,
  })
  assert.deepEqual(result, { promptPresented: false })
  assert.deepEqual(opened, ['job-2'])
})

test('finds only active awaiting second-copy prompts created by this device', () => {
  const orders = [
    { id: 'order-origin', status: 'Em preparo' },
    { id: 'order-other', status: 'Em preparo' },
  ]
  const jobs = [
    { ...awaitingSecondCopy, id: 'job-other', orderId: 'order-other' },
    awaitingSecondCopy,
  ]
  assert.equal(findOriginSecondCopyPrompt({ jobs, orders, originOrderIds: new Set(['order-origin']) })?.id, 'job-2')
  assert.equal(findOriginSecondCopyPrompt({ jobs, orders, originOrderIds: new Set(['order-other']) })?.id, 'job-other')
  assert.equal(findOriginSecondCopyPrompt({ jobs, orders, originOrderIds: new Set() }), null)
  assert.equal(findOriginSecondCopyPrompt({
    jobs: [awaitingSecondCopy],
    orders: [{ id: 'order-origin', status: 'Finalizado' }],
    originOrderIds: new Set(['order-origin']),
  }), null)
})

test('table-tab second copy is eligible without an order and keeps comanda title', () => {
  const job = {
    ...awaitingSecondCopy, type: 'table-tab', orderId: null,
    document: { tableTab: { number: 17 } },
  }
  assert.equal(isSecondCopyPromptEligible(job, null), true)
  assert.equal(getSecondCopyPromptTitle(job, null), 'Comanda #17')
})
