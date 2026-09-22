import assert from 'node:assert/strict'
import test from 'node:test'
import { act } from 'react-test-renderer'
import { buttonNamed, nodeText, workspaceHarness } from '../../../test-support/renderWorkspace.js'

const empty = { configured: false, waitingPairing: false, paired: false, pairedAt: null, lastSeenAt: null, revokedAt: null }
const waiting = { configured: true, waitingPairing: true, paired: false, pairedAt: null, lastSeenAt: null, revokedAt: null, pairingExpiresAt: '2026-09-22T18:30:00.000Z' }
const paired = { configured: true, waitingPairing: false, paired: true, pairedAt: '2026-09-22T18:00:00.000Z', lastSeenAt: '2026-09-22T18:05:00.000Z', revokedAt: null }

async function render(t, { granted = new Set(['orders.settings.manage']), state = empty, apiOverrides = {} } = {}) {
  const h = await workspaceHarness(t)
  const calls = []
  const api = {
    getKitchenTvSettings: async () => state,
    approveKitchenTvPairing: async (code) => { calls.push(['approve', code]); return waiting },
    revokeKitchenTvAccess: async () => { calls.push(['revoke']); return { ...empty, revokedAt: '2026-09-22T18:10:00.000Z' } },
    ...apiOverrides,
  }
  const { default: KitchenTvSettings } = await h.load('/src/app/surfaces/settings/KitchenTvSettings.jsx')
  const screen = await h.render(KitchenTvSettings, { granted, api, onNavigateHome() { calls.push(['home']) } })
  await act(async () => {})
  return { h, screen, calls }
}

test('initial state teaches the TV-first code flow and only enables connect for six digits', async (t) => {
  const { screen, calls } = await render(t)
  const text = nodeText(screen.root)
  assert.match(text, /Conectar uma TV/)
  assert.match(text, /cozinha-tv/)
  assert.match(text, /Código exibido na TV/)
  const input = screen.root.findByProps({ id: 'kitchen-tv-code' })
  assert.equal(buttonNamed(screen.root, 'Conectar TV').props.disabled, true)
  await act(async () => input.props.onChange({ target: { value: '482731' } }))
  assert.equal(buttonNamed(screen.root, 'Conectar TV').props.disabled, false)
  await act(async () => buttonNamed(screen.root, 'Conectar TV').props.onClick({ preventDefault() {} }))
  assert.deepEqual(calls, [['approve', '482731']])
  assert.match(nodeText(screen.root), /Aguardando a TV concluir a conexão/)
})

test('view-only access sees instructions without code submission controls', async (t) => {
  const { screen } = await render(t, { granted: new Set(['orders.settings.view']) })
  assert.match(nodeText(screen.root), /Somente leitura/)
  assert.equal(buttonNamed(screen.root, 'Conectar TV'), undefined)
})

test('approved code exposes only pending activation and expiry', async (t) => {
  const { screen } = await render(t, { state: waiting })
  const text = nodeText(screen.root)
  assert.match(text, /Código autorizado/)
  assert.match(text, /Aguardando a TV concluir a conexão/)
  assert.doesNotMatch(text, /#token=|Copiar link/)
})

test('paired manager confirms revocation before removing access', async (t) => {
  const { screen, calls } = await render(t, { state: paired })
  await act(async () => buttonNamed(screen.root, 'Revogar acesso').props.onClick())
  assert.match(nodeText(screen.root), /Revogar acesso da TV/)
  await act(async () => buttonNamed(screen.root, 'Confirmar revogação').props.onClick())
  assert.deepEqual(calls, [['revoke']])
  assert.match(nodeText(screen.root), /Conectar outra TV/)
})

test('invalid code failures remain visible', async (t) => {
  const { screen } = await render(t, { apiOverrides: { approveKitchenTvPairing: async () => { throw new Error('Código inválido ou expirado.') } } })
  const input = screen.root.findByProps({ id: 'kitchen-tv-code' })
  await act(async () => input.props.onChange({ target: { value: '123456' } }))
  await act(async () => buttonNamed(screen.root, 'Conectar TV').props.onClick({ preventDefault() {} }))
  assert.match(nodeText(screen.root), /Código inválido ou expirado/)
})
