import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
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

test('generated access prioritizes copy, masks the secret and keeps the fragment contract', async (t) => {
  const { screen, calls } = await render(t)
  await act(async () => buttonNamed(screen.root, 'Gerar acesso da TV').props.onClick())
  const text = nodeText(screen.root)
  assert.match(text, /Link pronto para pareamento/)
  assert.match(text, /cozinha-tv#token=••••••••/)
  assert.doesNotMatch(text, /token=one-time/)
  const copy = buttonNamed(screen.root, 'Copiar link')
  const regenerate = buttonNamed(screen.root, 'Gerar novo link')
  assert.match(copy.props.className, /button-primary/)
  assert.match(regenerate.props.className, /button-secondary/)
  assert.match(text, /Gerar outro link invalida este acesso/)
  assert.deepEqual(calls, ['generate'])
})

test('pairing layout contains long unbroken content on mobile instead of widening the page', async () => {
  const css = await readFile(new URL('./kitchenTvSettings.css', import.meta.url), 'utf8')
  assert.match(css, /\.kitchen-tv-settings-page[\s\S]*min-width:\s*0/)
  assert.match(css, /\.kitchen-tv-access-card[\s\S]*min-width:\s*0/)
  assert.match(css, /\.kitchen-tv-link-box[\s\S]*overflow:\s*hidden/)
  assert.match(css, /\.kitchen-tv-link-box code[\s\S]*text-overflow:\s*ellipsis/)
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.kitchen-tv-actions[\s\S]*flex-direction:\s*column/)
})

test('view-only access sees status without mutation controls', async (t) => {
  const { screen } = await render(t, { granted: new Set(['orders.settings.view']), state: paired })
  assert.match(nodeText(screen.root), /TV da cozinha ativa/)
  assert.match(nodeText(screen.root), /Somente leitura/)
  assert.equal(buttonNamed(screen.root, 'Gerar novo link'), undefined)
  assert.equal(buttonNamed(screen.root, 'Revogar acesso'), undefined)
})

test('persisted pending pairing remains visible after reload without disclosing its secret', async (t) => {
  const { screen } = await render(t, { granted: new Set(['orders.settings.view']), state: waiting })
  const text = nodeText(screen.root)
  assert.match(text, /Aguardando pareamento/)
  assert.doesNotMatch(text, /TV ainda não configurada|cozinha-tv#token=/)
  assert.equal(buttonNamed(screen.root, 'Gerar novo link'), undefined)
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
