import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const overlays = await readFile(new URL('./domains/printing/ui/PrintingOverlays.jsx', import.meta.url), 'utf8')
const hook = await readFile(new URL('./domains/printing/application/usePrintingOverlays.js', import.meta.url), 'utf8')

test('recovery UI only becomes actionable for a physically ready printer and includes the approved copy-by-copy actions', () => {
  for (const label of [
    'Impressora disponível novamente',
    'Como a impressora não possui corte automático, as vias serão impressas uma de cada vez.',
    'Imprimir agora',
    'Agora não',
    'Descartar todas',
    'Via impressa',
    'Separe o papel antes de continuar.',
    'Imprimir próxima',
    'Parar por agora',
  ]) assert.match(overlays, new RegExp(label))
  assert.match(overlays, /recoveryPromptEligible\s*&&\s*physicalPrinterReady/)
  assert.match(overlays, /recoveryPendingCount/)
})

test('bulk discard stays explicit while recovery reopens only its affinity second-copy prompt', () => {
  assert.match(overlays, /Descartar /)
  assert.match(overlays, /trabalhos\?/)
  assert.match(overlays, /cancelLabel=\{recoveryState !== 'normal'[\s\S]*'Parar por agora'[\s\S]*'Depois'/)
  assert.match(hook, /printing\.discardRecoveryBacklog\(\)/)
  assert.match(hook, /recoveryJobId/)
  assert.match(hook, /pausedRecoverySecondCopyJobIdRef/)
  assert.match(hook, /previousRecoveryStateRef\.current === 'deferred' && recoveryState === 'active'/)
  assert.match(hook, /pausedRecoverySecondCopyJobIdRef\.current = null[\s\S]*printing\.resumeRecovery\(\)/)
  assert.match(hook, /printing\.startRecovery\(\)/)
  assert.match(hook, /printing\.resumeRecovery\(\)[\s\S]*printing\.printNextRecovery\(\)/)
  assert.match(hook, /selectSecondCopyPromptCandidate/)
})
