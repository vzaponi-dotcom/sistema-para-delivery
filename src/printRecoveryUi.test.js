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

test('bulk discard requires a count-specific confirmation and recovery never auto-opens a second-copy prompt', () => {
  assert.match(app, /Descartar \$\{recoveryPendingCount\} trabalhos\?/)
  assert.match(app, /printing\.discardRecoveryBacklog\(\)/)
  assert.match(app, /if \(recoveryState !== 'normal'\)[\s\S]*canPresentSecondCopyPrompt/)
  assert.match(app, /printing\.startRecovery\(\)/)
  assert.match(app, /printing\.resumeRecovery\(\)[\s\S]*printing\.printNextRecovery\(\)/)
})
