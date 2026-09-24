import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('mobile Settings floating back control stays below and behind the sticky top bar', async () => {
  const [foundation, controls, topbar] = await Promise.all([
    read('./mobile-foundation.css'),
    read('./settings-controls.css'),
    read('./app-top-bar.css'),
  ])

  assert.match(foundation, /--layer-sticky-topbar:\s*30/)
  assert.match(foundation, /--mobile-topbar-stack-height:\s*66px/)

  const mobileControls = controls.slice(controls.indexOf('@media (max-width: 720px)'))
  assert.match(
    mobileControls,
    /\.settings-back-link--floating\s*\{[^}]*top:\s*calc\(var\(--mobile-topbar-stack-height\)\s*\+\s*var\(--mobile-floating-gap\)\s*\+\s*env\(safe-area-inset-top,\s*0px\)\)[^}]*z-index:\s*calc\(var\(--layer-sticky-topbar\)\s*-\s*1\)/s,
  )

  assert.match(topbar, /\.app-topbar\s*\{[^}]*z-index:\s*var\(--layer-sticky-topbar\)/s)
})
