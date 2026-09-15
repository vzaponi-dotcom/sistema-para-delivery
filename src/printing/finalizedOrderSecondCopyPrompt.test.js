import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const appSource = await readFile(new URL('../App.jsx', import.meta.url), 'utf8')
const managerSource = await readFile(new URL('./usePrintingManager.js', import.meta.url), 'utf8')
const promptFlowSource = await readFile(new URL('./secondCopyPromptFlow.js', import.meta.url), 'utf8')

test('global second-copy prompt delegates order and comanda eligibility to the shared flow', () => {
  assert.match(appSource, /import \{[^}]*isSecondCopyPromptEligible[^}]*\} from '.\/printing\/secondCopyPromptFlow\.js'/)
  assert.match(promptFlowSource, /job\?\.type === 'table-tab'/)
  assert.match(promptFlowSource, /job\?\.type === 'order' && Boolean\(order\) && isActiveOrder\(order\)/)
  assert.match(appSource, /isSecondCopyPromptEligible\(current, currentOrder\)/)
  assert.match(appSource, /isSecondCopyPromptEligible\(job, order\)/)
})

test('second-copy prompt is acknowledged once by the eligible primary QZ station', () => {
  assert.match(promptFlowSource, /job\?\.status === 'awaiting_second_copy'/)
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
  const promptStart = appSource.indexOf('const candidates =')
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
