import assert from 'node:assert/strict'
import test from 'node:test'
import { act } from 'react-test-renderer'
import { buttonNamed, nodeText, workspaceHarness } from '../../../test-support/renderWorkspace.js'

const empty = { configured: false, waitingPairing: false, paired: false, pairedAt: null, lastSeenAt: null, revokedAt: null }
const waiting = { configured: true, waitingPairing: true, paired: false, pairedAt: null, lastSeenAt: null, revokedAt: null }
const paired = { configured: true, waitingPairing: false, paired: true, pairedAt: '2026-09-22T18:00:00.000Z', lastSeenAt: '2026-09-22T18:05:00.000Z', revokedAt: null }

async function render(t, { granted = new Set(['orders.settings.manage']), state = empty, apiOverrides = {} } = {}) {
  const h = await workspaceHarness(t)
  const calls = []
  const api = {
    getKitchenTvSettings: async () => state,
    generateKitchenTvAccess: async () => {
      calls.push('generate')
      return { pairingUrl: 'https://delivery.example/cozinha-tv#token=one-time', expiresAt: '2026-09-22T18:30:00.000Z' }
    },
    revokeKitchenTvAccess: async () => { calls.push('revoke'); return { ...empty, revokedAt: '2026-09-22T18:10:00.000Z' } },
    ...apiOverrides,
  }
  const { default: KitchenTvSettings } = await h.load('/src/app/surfaces/settings/KitchenTvSettings.jsx')
  const screen = await h.render(KitchenTvSettings, { granted, api, onNavigateHome() { calls.push('home') } })
  await act(async () => {})
  return { h, screen, calls }
}

test('generates and copies a fragment-only one-time pairing link', async (t) => {
  const { screen, calls } = await render(t)
  await act(async () => buttonNamed(screen.root, 'Gerar acesso da TV').props.onClick())
  const text = nodeText(screen.root)
  assert.match(text, /Link de uso único/)
  assert.match(text, /cozinha-tv#token=one-time/)
  assert.ok(buttonNamed(screen.root, 'Copiar link'))
  assert.ok(buttonNamed(screen.root, 'Gerar novo acesso'))
  assert.deepEqual(calls, ['generate'])
})

test('view-only access sees status without mutation controls', async (t) => {
  const { screen } = await render(t, { granted: new Set(['orders.settings.view']), state: paired })
  assert.match(nodeText(screen.root), /TV da cozinha ativa/)
  assert.match(nodeText(screen.root), /Somente leitura/)
  assert.equal(buttonNamed(screen.root, 'Gerar novo acesso'), undefined)
  assert.equal(buttonNamed(screen.root, 'Revogar acesso'), undefined)
})

test('persisted pending pairing remains visible after reload without disclosing its secret', async (t) => {
  const { screen } = await render(t, { granted: new Set(['orders.settings.view']), state: waiting })
  const text = nodeText(screen.root)
  assert.match(text, /Aguardando pareamento/)
  assert.doesNotMatch(text, /TV ainda não configurada|cozinha-tv#token=/)
  assert.equal(buttonNamed(screen.root, 'Gerar novo acesso'), undefined)
})

test('paired manager confirms revocation before removing access', async (t) => {
  const { screen, calls } = await render(t, { state: paired })
  await act(async () => buttonNamed(screen.root, 'Revogar acesso').props.onClick())
  assert.match(nodeText(screen.root), /Revogar acesso da TV/)
  await act(async () => buttonNamed(screen.root, 'Confirmar revogação').props.onClick())
  assert.deepEqual(calls, ['revoke'])
  assert.match(nodeText(screen.root), /Acesso revogado/)
})

test('API failures remain visible and retryable', async (t) => {
  const { screen } = await render(t, { apiOverrides: { getKitchenTvSettings: async () => { throw new Error('Falha de rede') } } })
  const alert = screen.root.findByProps({ role: 'alert' })
  assert.match(nodeText(alert), /Falha de rede/)
  assert.ok(buttonNamed(screen.root, 'Tentar novamente'))
})
