import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { act } from 'react-test-renderer'
import { workspaceHarness, nodeText } from '../../../test-support/renderWorkspace.js'
import { authenticatedSession } from '../../../test-support/appSessionFixtures.js'

const overlayUrl = new URL('./PrintingOverlays.jsx', import.meta.url)

test('PrintingOverlays owns the existing dialog copy without redesign', async () => {
  assert.equal(existsSync(overlayUrl), true)
  if (!existsSync(overlayUrl)) return
  const source = await readFile(overlayUrl, 'utf8')
  for (const label of [
    'Impressora disponível novamente',
    'Via impressa',
    'Descartar ',
    ' trabalhos?',
    '1ª via impressa',
    'Imprimir 2ª via',
    'Parar por agora',
    'Depois',
    'Solicitar 2ª via',
  ]) assert.equal(source.includes(label), true, label)
})

test('actual App composes one operational printing overlay with granted actions and global feedback', async t => {
  const h = await workspaceHarness(t)
  globalThis.fetch = async path => {
    const payload = path === '/api/auth/session' ? authenticatedSession
      : path === '/api/bootstrap' ? { orders: [], clients: [], products: [], tables: [], tableTabs: [], movements: [] }
      : path === '/api/orders' ? { orders: [] }
      : path === '/api/printing/stations' ? { stations: [{ id: 'test-station', platform: 'other', isPrimary: false, autoPrintEnabled: false }] }
      : String(path).startsWith('/api/printing/jobs?') ? { jobs: [] }
      : path === '/api/printing/jobs/summary' ? { summary: {} } : null
    assert.ok(payload, `Unexpected ${path}`)
    return { ok: true, json: async () => payload }
  }
  const { default: App } = await h.load('/src/App.jsx')
  const { default: PrintingOverlays } = await h.load('/src/domains/printing/ui/PrintingOverlays.jsx')
  const { renderer } = await h.renderAdminApp(App)
  const overlays = renderer.root.findAllByType(PrintingOverlays)
  assert.equal(overlays.length, 1)
  assert.equal(overlays[0].props.authenticated, true)
  assert.equal(overlays[0].props.canExecutePrinting, true)
  assert.equal(overlays[0].props.canDiscardPrinting, true)
  await act(async () => overlays[0].props.onSuccess('Resultado oficial confirmado'))
  assert.match(nodeText(renderer.root), /Resultado oficial confirmado/)
  await act(async () => overlays[0].props.onError(new Error('Erro atual da impressão')))
  assert.match(nodeText(renderer.root), /Erro atual da impressão/)
})
