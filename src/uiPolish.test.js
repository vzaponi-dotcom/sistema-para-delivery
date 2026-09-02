import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

test('toast notifications are anchored at the top instead of the bottom', () => {
  const css = source('./App.css')
  const toastBlock = css.match(/\.toast-success\s*\{[\s\S]*?\}/)?.[0] || ''

  assert.match(toastBlock, /top:/)
  assert.doesNotMatch(toastBlock, /bottom:/)
})

test('mobile modals remain centered on screen', () => {
  const css = source('./App.css')
  const mobileSection = css.slice(css.indexOf('@media (max-width: 640px)'))

  assert.match(mobileSection, /\.modal-backdrop\s*\{[\s\S]*?place-items:\s*center/)
})
