import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const settingsControlsCss = readFileSync(new URL('./settings-controls.css', import.meta.url), 'utf8')
const settingsControlsSource = readFileSync(new URL('./components/SettingsControls.jsx', import.meta.url), 'utf8')
const comandasCss = readFileSync(new URL('./comandas.css', import.meta.url), 'utf8')

const ruleBody = (css, selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] || ''
}

test('settings back control floats with the viewport and becomes compact on mobile', () => {
  const backRule = ruleBody(settingsControlsCss, '.settings-back-link')
  assert.match(backRule, /position:\s*fixed/)
  assert.match(backRule, /bottom:/)
  assert.match(backRule, /right:/)
  assert.match(backRule, /z-index:/)
  assert.match(settingsControlsCss, /@media\s*\(max-width:\s*720px\)[\s\S]*\.settings-back-link\s*>\s*span:last-child\s*\{[\s\S]*display:\s*none/)
  assert.match(settingsControlsCss, /env\(safe-area-inset-bottom/)
})

test('settings back control escapes transformed page content and clears the mobile navigation layer', () => {
  const backRule = ruleBody(settingsControlsCss, '.settings-back-link')
  assert.match(settingsControlsSource, /createPortal/)
  assert.match(settingsControlsSource, /document\.body/)
  assert.match(backRule, /z-index:\s*var\(--layer-floating-action/)
  assert.match(settingsControlsCss, /var\(--mobile-bottom-nav-height/)
  assert.match(settingsControlsCss, /var\(--mobile-floating-gap/)
})

test('comanda hero centers identity and table status metadata inside their columns', () => {
  const identity = ruleBody(comandasCss, '.comanda-detail-identity')
  const info = ruleBody(comandasCss, '.comanda-detail-hero-info')
  const chips = ruleBody(comandasCss, '.comanda-detail-hero-chips')
  const time = ruleBody(comandasCss, '.comanda-detail-hero time')

  assert.match(identity, /justify-items:\s*center/)
  assert.match(identity, /text-align:\s*center/)
  assert.match(info, /justify-items:\s*center/)
  assert.match(info, /text-align:\s*center/)
  assert.match(chips, /justify-content:\s*center/)
  assert.match(time, /justify-content:\s*center/)
})
