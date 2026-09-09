import test from 'node:test'
import assert from 'node:assert/strict'
import {
  acknowledgeAndOpenSecondCopyPrompt,
  findOriginSecondCopyPrompt,
  rememberOriginOrderId,
  readOriginOrderIds,
} from './secondCopyPromptFlow.js'

const awaitingSecondCopy = {
  id: 'job-2',
  orderId: 'order-origin',
  status: 'awaiting_second_copy',
  copiesRequested: 2,
  copiesPrinted: 1,
}

test('opens the primary-station prompt after acknowledgement refreshes the print queue', async () => {
  const opened = []
  const result = await acknowledgeAndOpenSecondCopyPrompt({
    job: awaitingSecondCopy,
    acknowledge: async () => {
      await Promise.resolve() // Models the manager refresh before its promise resolves.
      return { promptPresented: true }
    },
    openPrompt: (jobId) => opened.push(jobId),
  })

  assert.deepEqual(result, { promptPresented: true })
  assert.deepEqual(opened, ['job-2'])
})

test('finds an awaiting second-copy prompt only for an order created by this device', () => {
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
})

test('does not show the origin prompt for one-copy, completed, or locally dismissed jobs', () => {
  const originOrderIds = new Set(['order-origin'])
  const activeOrder = [{ id: 'order-origin', status: 'Em preparo' }]

  assert.equal(findOriginSecondCopyPrompt({
    jobs: [{ ...awaitingSecondCopy, copiesRequested: 1 }], orders: activeOrder, originOrderIds,
  }), null)
  assert.equal(findOriginSecondCopyPrompt({
    jobs: [{ ...awaitingSecondCopy, status: 'printed', copiesPrinted: 2 }], orders: activeOrder, originOrderIds,
  }), null)
  assert.equal(findOriginSecondCopyPrompt({
    jobs: [awaitingSecondCopy], orders: activeOrder, originOrderIds, dismissedJobIds: new Set(['job-2']),
  }), null)
})

test('persists only the creating browser order ids used to target remote prompts', () => {
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }

  rememberOriginOrderId('order-origin', storage)
  rememberOriginOrderId('order-origin', storage)
  rememberOriginOrderId('order-next', storage)

  assert.deepEqual([...readOriginOrderIds(storage)].sort(), ['order-next', 'order-origin'])
})
