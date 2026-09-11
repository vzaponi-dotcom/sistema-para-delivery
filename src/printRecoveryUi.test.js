import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const app = await readFile(new URL('./App.jsx', import.meta.url), 'utf8')

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
  ]) assert.match(app, new RegExp(label))
  assert.match(app, /recoveryPromptEligible\s*&&\s*physicalPrinterReady/)
  assert.match(app, /recoveryPendingCount/)
})

test('bulk discard stays explicit while recovery reopens only its affinity second-copy prompt', () => {
  assert.match(app, /Descartar \$\{recoveryPendingCount\} trabalhos\?/)
  assert.match(app, /printing\.discardRecoveryBacklog\(\)/)
  assert.match(app, /recoveryJobId/)
  assert.match(app, /pausedRecoverySecondCopyJobIdRef/)
  assert.match(app, /secondCopyPromptJob[\s\S]*cancelLabel="Parar por agora"/)
  assert.match(app, /if \(recoveryState === 'active'\) void printing\.deferRecovery\(\)/)
  assert.match(app, /if \(hasRecoveryAffinity && pausedRecoverySecondCopyJobIdRef\.current === recoveryJobId\) return/)
  assert.doesNotMatch(app, /recoveryState === 'active' && pausedRecoverySecondCopyJobIdRef\.current === recoveryJobId/)
  assert.match(app, /previousRecoveryStateRef\.current === 'deferred' && recoveryState === 'active'/)
  assert.match(app, /pausedRecoverySecondCopyJobIdRef\.current = null[\s\S]*printing\.resumeRecovery\(\)/)
  assert.match(app, /printing\.startRecovery\(\)/)
  assert.match(app, /printing\.resumeRecovery\(\)[\s\S]*printing\.printNextRecovery\(\)/)
})
