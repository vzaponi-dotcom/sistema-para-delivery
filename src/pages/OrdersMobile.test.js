import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

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
