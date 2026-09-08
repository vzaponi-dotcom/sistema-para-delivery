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

test('second-copy prompt is acknowledged once by the eligible primary QZ station', () => {
  assert.match(appSource, /job\?\.status === 'awaiting_second_copy'/)
  assert.match(appSource, /canPresentSecondCopyPrompt\(\{\s*isQz: printing\.transportKind === 'qz',\s*station: printing\.localStation, job,/)
  assert.match(appSource, /printing\.acknowledgeSecondCopyPrompt\(next\)/)
  assert.match(appSource, /cancelLabel="Depois"/)
  assert.doesNotMatch(appSource, /dismissedSecondCopyJobIdsRef/)
})
