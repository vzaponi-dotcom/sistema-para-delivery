import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const appSource = await readFile(new URL('../App.jsx', import.meta.url), 'utf8')

test('global second-copy prompt only selects waiting jobs whose order is still active', () => {
  assert.match(appSource, /job\?\.status === 'waiting_second_copy'/)
  assert.match(appSource, /isOrderActive\(order\)/)
  assert.match(appSource, /isSecondCopyPromptEligible\(current, currentOrder, printing\)/)
  assert.match(appSource, /isSecondCopyPromptEligible\(job, order, printing\)/)
})

test('second-copy prompt is operational only on the primary Windows QZ station', () => {
  assert.match(appSource, /printing\?\.transportKind === 'qz'/)
  assert.match(appSource, /printing\?\.localStation\?\.isPrimary/)
  assert.match(appSource, /printing\?\.localStation\?\.platform === 'windows'/)
})

test('second-copy prompt presentation survives reload for the same transition', () => {
  assert.match(appSource, /sessionStorage/)
  assert.match(appSource, /printing:second-copy-prompt-presented:v1/)
  assert.match(appSource, /getSecondCopyPromptTransitionId/)
})

test('choosing Depois only closes the prompt and keeps the central job waiting', () => {
  assert.match(appSource, /cancelLabel="Depois"/)
  const start = appSource.indexOf('const dismissSecondCopyPrompt')
  assert.notEqual(start, -1)
  const end = appSource.indexOf('const handleGlobalSecondCopy', start)
  assert.notEqual(end, -1)
  const block = appSource.slice(start, end)
  assert.doesNotMatch(block, /printSecondCopy\(/)
  assert.doesNotMatch(block, /completePrintJob\(/)
})

test('second-copy prompt reacts when an order is finalized', () => {
  assert.match(appSource, /printing\.jobs, orders, secondCopyPromptJobId/)
})
