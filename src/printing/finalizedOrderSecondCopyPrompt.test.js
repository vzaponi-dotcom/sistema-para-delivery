import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const appSource = await readFile(new URL('../App.jsx', import.meta.url), 'utf8')

test('global second-copy prompt only selects jobs whose order is still active', () => {
  assert.match(
    appSource,
    /const isSecondCopyPromptEligible = \(job, order\) => isAwaitingSecondCopyJob\(job\) && isOrderActive\(order\)/,
  )
  assert.match(appSource, /isSecondCopyPromptEligible\(current, currentOrder\)/)
  assert.match(appSource, /isSecondCopyPromptEligible\(job, order\)/)
})

test('second-copy prompt reacts when an order is finalized', () => {
  assert.match(
    appSource,
    /\[printing\.jobs, orders, secondCopyPromptJobId\]/,
  )
})
