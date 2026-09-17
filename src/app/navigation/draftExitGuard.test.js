import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldConfirmDraftExit } from './draftExitGuard.js'

const draft = Object.freeze({
  dirty: true,
  status: 'ready',
  destinations: new Set(['settings-operations', 'settings-modalities']),
})

test('confirma somente ao sair de um draft sujo para fora de seus destinos', () => {
  assert.equal(shouldConfirmDraftExit(draft, 'settings-operations', 'settings-modalities'), false)
  assert.equal(shouldConfirmDraftExit(draft, 'settings-operations', 'clients'), true)
})

test('não confirma drafts limpos, em gravação, não confirmados ou sem destino ativo', () => {
  assert.equal(shouldConfirmDraftExit({ ...draft, dirty: false }, 'settings-operations', 'clients'), false)
  assert.equal(shouldConfirmDraftExit({ ...draft, status: 'saving' }, 'settings-operations', 'clients'), false)
  assert.equal(shouldConfirmDraftExit({ ...draft, status: 'unconfirmed' }, 'settings-operations', 'clients'), false)
  assert.equal(shouldConfirmDraftExit(draft, 'settings-home', 'clients'), false)
})
