import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import * as printing from '../index.js'

const appSource = await readFile(new URL('../../../App.jsx', import.meta.url), 'utf8')

test('PrintingOverlays is a public Printing surface', () => {
  assert.equal(typeof printing.PrintingOverlays, 'function')
})

test('App no longer owns second-copy or recovery overlay state', () => {
  for (const token of [
    'secondCopyPromptJobId',
    'originSecondCopyPromptJobId',
    'recoveryDialogMode',
    'pausedRecoverySecondCopyJobIdRef',
    'canPresentSecondCopyPrompt',
    'canKeepSecondCopyPromptOpen',
  ]) {
    assert.equal(appSource.includes(token), false, token)
  }
})

test('App delegates origin-order persistence to the Printing manager', () => {
  assert.doesNotMatch(appSource, /secondCopyPromptFlow|readOriginOrderIds|rememberOriginOrderId/)
  assert.match(appSource, /printing\.rememberOriginOrder\(order\.id\)/)
})

test('deferred recovery keeps affinity with copy 2 before another queued job', async () => {
  const { selectSecondCopyPromptCandidate } = await import('./usePrintingOverlays.js')
  const station = {
    id: 'kitchen-primary',
    recoveryState: 'deferred',
    recoveryJobId: 'job-a',
  }
  const jobs = [
    { id: 'job-a', type: 'table-tab', status: 'awaiting_second_copy', copiesRequested: 2, copiesPrinted: 1 },
    { id: 'job-b', type: 'order', orderId: 'order-b', status: 'pending', copiesRequested: 1, copiesPrinted: 0 },
  ]

  const selected = selectSecondCopyPromptCandidate({
    jobs,
    orders: [],
    transportKind: 'qz',
    transportReady: true,
    printerBlocked: false,
    station,
    recoveryState: 'deferred',
    pausedRecoverySecondCopyJobId: null,
  })

  assert.equal(selected?.id, 'job-a')
})
