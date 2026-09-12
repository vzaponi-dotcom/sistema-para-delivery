import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { act } from 'react-test-renderer'
import { buttonNamed, nodeText, workspaceHarness } from '../test-support/renderWorkspace.js'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('mobile kitchen header separates the primary action without changing copy or callbacks', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Orders } = await h.load('/src/pages/Orders.jsx')
  const calls = []
  const renderer = await h.render(Orders, {
    orders: [],
    now: new Date('2026-09-12T15:00:00.000Z'),
    search: '',
    onSearchChange() {},
    currency: (value) => `R$ ${value}`,
    onNewOrder: () => calls.push('new-order'),
    onFinalizeOrder() {},
    onCancelOrder() {},
    onNavigate() {},
    onNavigatePrintQueue: () => calls.push('print-queue'),
    onSoundEnabledChange: (enabled) => calls.push(`sound:${enabled}`),
    granted: new Set(['orders.view', 'orders.history']),
    implemented: new Set(['orders', 'history']),
  })

  const header = renderer.root.findByType('header')
  assert.equal(nodeText(header.findByProps({ className: 'page-header-copy' })), 'OperaçãoCozinhaAcompanhe os pedidos em preparo e agendados')

  const primary = header.findByProps({ className: 'kitchen-header-primary-action' })
  const secondary = header.findByProps({ className: 'kitchen-header-secondary-actions' })
  assert.deepEqual(primary.findAllByType('button').map(nodeText), ['Novo pedido'])
  assert.deepEqual(secondary.findAllByType('button').map(nodeText), ['Som ativado', 'Fila de impressão'])

  await act(async () => buttonNamed(primary, 'Novo pedido').props.onClick())
  await act(async () => buttonNamed(secondary, 'Som ativado').props.onClick())
  await act(async () => buttonNamed(secondary, 'Fila de impressão').props.onClick())
  assert.deepEqual(calls, ['new-order', 'sound:false', 'print-queue'])
})

test('mobile kitchen header aligns its copy and stacks primary above secondary actions', async () => {
  const compactControls = await read('../mobile-compact-controls.css')
  const narrow = compactControls.slice(compactControls.indexOf('@media (max-width: 640px)'))

  assert.match(narrow, /\.kitchen-page \.page-header-copy\s*\{[^}]*width:\s*100%[^}]*text-align:\s*left/s)
  assert.match(narrow, /\.kitchen-page \.kitchen-header-actions\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s)
  assert.match(narrow, /\.kitchen-page \.kitchen-header-primary-action \.button\s*\{[^}]*width:\s*100%[^}]*min-height:\s*48px/s)
  assert.match(narrow, /\.kitchen-page \.kitchen-header-secondary-actions\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s)
  assert.ok(
    narrow.indexOf('.kitchen-page .kitchen-header-primary-action .button') > narrow.indexOf('.kitchen-page .kitchen-header-actions .button'),
    'the primary action must override the shared mobile button sizing',
  )
})

test('mobile classic tickets preserve full actions and comfortable touch targets', async () => {
  const css = await read('../order-operations-compact.css')
  const narrow = css.slice(css.lastIndexOf('@media (max-width: 640px)'))

  assert.match(narrow, /\.kitchen-ticket-actions\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:/s)
  assert.match(narrow, /\.kitchen-ticket-actions \.button\s*\{[^}]*min-height:\s*var\(--mobile-touch-target\)[^}]*white-space:\s*normal/s)
  assert.match(narrow, /\.kitchen-ticket-timing\s*\{[^}]*overflow-wrap:\s*anywhere/s)
})

test('mobile queue headings and empty states remain readable for both permanent queues', async () => {
  const orders = await read('./Orders.jsx')
  const css = await read('../order-operations-compact.css')
  const narrow = css.slice(css.lastIndexOf('@media (max-width: 640px)'))

  assert.equal(orders.match(/className="kitchen-queue-section" aria-labelledby=/g)?.length, 2)
  assert.match(narrow, /\.kitchen-queue-heading\s*\{[^}]*align-items:\s*flex-start/s)
  assert.match(narrow, /\.kitchen-queue-help\s*\{[^}]*white-space:\s*normal/s)
  assert.match(narrow, /\.kitchen-queue-empty\s*\{[^}]*min-width:\s*0/s)
})

test('mobile kitchen retains two-by-two stats, note clamp, wrap protection and reduced motion', async () => {
  const compact = await read('../order-operations-compact.css')
  const base = await read('../order-operations.css')

  assert.match(compact, /@media\s*\(max-width:\s*640px\)[\s\S]*\.kitchen-stats\s*\{[^}]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s)
  assert.match(base, /\.kitchen-ticket-note\s*\{[^}]*-webkit-line-clamp:\s*2[^}]*overflow:\s*hidden[^}]*overflow-wrap:\s*anywhere/s)
  assert.match(compact, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.kitchen-ticket-highlighted\s*\{[^}]*animation:\s*none/s)
})

test('history text still wraps instead of clipping in the final compact cascade', async () => {
  const css = await read('../order-operations-compact.css')

  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.order-history-main span\s*\{[^}]*white-space:\s*normal[^}]*overflow-wrap:\s*anywhere/s)
})
