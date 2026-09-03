import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('compact kitchen CSS keeps mobile actions inside the card', async () => {
  const css = await read('../order-operations-compact.css')

  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.order-queue-actions\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:/s)
  assert.doesNotMatch(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.order-queue-actions\s*\{[^}]*flex-wrap:\s*nowrap/s)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.order-queue-actions \.button\s*\{[^}]*min-height:\s*(?:44px|var\(--mobile-touch-target\))/s)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.order-queue-actions \.icon-button\s*\{[^}]*min-width:\s*(?:44px|var\(--mobile-touch-target\))[^}]*min-height:\s*(?:44px|var\(--mobile-touch-target\))/s)
})

test('kitchen item toggle is a comfortable touch target', async () => {
  const css = await read('../order-operations-compact.css')
  assert.match(css, /\.order-items-toggle\s*\{[^}]*min-height:\s*(?:44px|var\(--mobile-touch-target\))/s)
})

test('mobile kitchen customer and operation text can wrap instead of clipping', async () => {
  const css = await read('../order-operations.css')

  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.order-queue-title span:not\(\.status-badge\)\s*\{[^}]*white-space:\s*normal[^}]*overflow-wrap:\s*anywhere/s)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.order-history-main span\s*\{[^}]*white-space:\s*normal[^}]*overflow-wrap:\s*anywhere/s)
})
