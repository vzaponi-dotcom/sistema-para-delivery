import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const appSource = await readFile(new URL('../App.jsx', import.meta.url), 'utf8')
const managerSource = await readFile(new URL('./usePrintingManager.js', import.meta.url), 'utf8')

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
  assert.match(appSource, /canPresentSecondCopyPrompt\(\{\s*isQz: printTransportKind === 'qz',\s*transportReady: printTransportReady,\s*printerBlocked,\s*station: localPrintStation,\s*job,/)
  assert.match(appSource, /acknowledgeAndOpenSecondCopyPrompt\(\{[\s\S]*acknowledge: acknowledgeSecondCopyPrompt/)
  assert.match(appSource, /cancelLabel="Depois"/)
  assert.doesNotMatch(appSource, /dismissedSecondCopyJobIdsRef/)
})

test('second-copy acknowledgement returns before queue refresh can cancel the popup effect', () => {
  const start = managerSource.indexOf('const acknowledgeSecondCopyPrompt = useCallback')
  const end = managerSource.indexOf('const retryJob = useCallback', start)
  assert.notEqual(start, -1)
  assert.notEqual(end, -1)
  const acknowledgement = managerSource.slice(start, end)

  assert.match(acknowledgement, /(?:await )?acknowledgeSecondCopyPromptApi\(job\.id, station\.id\)/)
  assert.doesNotMatch(acknowledgement, /await refresh\(\)/)
})

test('second-copy prompt eligibility reacts when local QZ readiness changes', () => {
  const promptStart = appSource.indexOf('const next = printJobs.find')
  const promptEnd = appSource.indexOf('useEffect(() => () =>', promptStart)
  assert.notEqual(promptStart, -1)
  assert.notEqual(promptEnd, -1)
  const promptEffect = appSource.slice(promptStart, promptEnd)

  assert.doesNotMatch(promptEffect, /\bprinting\./)
  assert.match(promptEffect, /\[printJobs,[^\]]*printTransportReady[^\]]*printerBlocked[^\]]*\]/)
})

test('an already-open second-copy prompt is revalidated before display and before physical confirmation', () => {
  assert.match(appSource, /if \(!isSecondCopyPromptEligible\(current, currentOrder\) \|\| !canKeepSecondCopyPromptOpen\(/)
  assert.match(appSource, /const handleGlobalSecondCopy = async \(\) => \{[\s\S]*canKeepSecondCopyPromptOpen\(/)
  assert.match(appSource, /setSecondCopyPromptJobId\(null\)[\s\S]*return/)
})
