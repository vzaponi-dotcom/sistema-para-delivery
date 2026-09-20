import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const appSource = await readFile(new URL('../App.jsx', import.meta.url), 'utf8')
const overlaySource = await readFile(new URL('../domains/printing/ui/PrintingOverlays.jsx', import.meta.url), 'utf8')
const hookSource = await readFile(new URL('../domains/printing/application/usePrintingOverlays.js', import.meta.url), 'utf8')
const managerSource = await readFile(new URL('../domains/printing/application/usePrintingManager.js', import.meta.url), 'utf8')
const promptFlowSource = await readFile(new URL('../domains/printing/domain/secondCopy.js', import.meta.url), 'utf8')

test('global second-copy prompt delegates order and comanda eligibility to the shared flow', () => {
  assert.equal(appSource.includes("from './domains/printing/index.js'"), true)
  assert.equal(hookSource.includes('isSecondCopyPromptEligible'), true)
  assert.match(promptFlowSource, /job\?\.type === 'table-tab'/)
  assert.match(promptFlowSource, /job\?\.type === 'order' && Boolean\(order\) && isActiveOrder\(order\)/)
  assert.match(hookSource, /isSecondCopyPromptEligible\(current, currentOrder\)/)
  assert.match(hookSource, /isSecondCopyPromptEligible\(job, order\)/)
})

test('second-copy prompt is acknowledged once by the eligible primary QZ station', () => {
  assert.match(promptFlowSource, /job\?\.status === 'awaiting_second_copy'/)
  assert.match(hookSource, /canPresentSecondCopyPrompt\(\{\s*isQz: printTransportKind === 'qz',\s*transportReady: printTransportReady,\s*printerBlocked,\s*station: localPrintStation,\s*job,/)
  assert.match(hookSource, /acknowledgeAndOpenSecondCopyPrompt\(\{[\s\S]*acknowledge: acknowledgeSecondCopyPrompt/)
  assert.match(overlaySource, /'Parar por agora' : 'Depois'/)
  assert.doesNotMatch(hookSource, /dismissedSecondCopyJobIdsRef/)
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
  assert.match(hookSource, /selectSecondCopyPromptCandidate/)
  assert.match(hookSource, /canPresentSecondCopyPrompt/)
  assert.match(hookSource, /transportReady/)
  assert.match(hookSource, /printerBlocked/)
})

test('an already-open second-copy prompt is revalidated before display and before physical confirmation', () => {
  assert.match(appSource, /if \(!isSecondCopyPromptEligible\(current, currentOrder\) \|\| !canKeepSecondCopyPromptOpen\(/)
  assert.match(hookSource, /const handleGlobalSecondCopy = async \(\) => \{[\s\S]*canKeepSecondCopyPromptOpen\(/)
  assert.match(hookSource, /setSecondCopyPromptJobId\(null\)[\s\S]*return/)
})
