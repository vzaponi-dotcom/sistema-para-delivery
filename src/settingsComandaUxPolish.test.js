import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const settingsControlsCss = readFileSync(new URL('./settings-controls.css', import.meta.url), 'utf8')
const settingsControlsSource = readFileSync(new URL('./app/surfaces/settings/components/SettingsBackAndSwitchControls.jsx', import.meta.url), 'utf8')
const comandasCss = readFileSync(new URL('./comandas.css', import.meta.url), 'utf8')

const ruleBody = (css, selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] || ''
}

test('settings back control stays inline until its original position leaves the viewport', () => {
  assert.match(settingsControlsSource, /useRef/)
  assert.match(settingsControlsSource, /useEffect/)
  assert.match(settingsControlsSource, /IntersectionObserver/)
  assert.match(settingsControlsSource, /settings-back-link--inline/)
  assert.match(settingsControlsSource, /settings-back-link--floating/)
  assert.match(settingsControlsSource, /createPortal/)
  assert.match(settingsControlsSource, /document\.body/)

  const inlineRule = ruleBody(settingsControlsCss, '.settings-back-link--inline')
  const floatingRule = ruleBody(settingsControlsCss, '.settings-back-link--floating')
  assert.doesNotMatch(inlineRule, /position:\s*fixed/)
  assert.match(floatingRule, /position:\s*fixed/)
  assert.match(floatingRule, /top:/)
  assert.match(floatingRule, /left:/)
  assert.match(floatingRule, /z-index:\s*var\(--layer-floating-action/)
})

test('floating settings back control becomes compact on mobile', () => {
  assert.match(settingsControlsCss, /@media\s*\(max-width:\s*720px\)[\s\S]*\.settings-back-link--floating\s*>\s*span:last-child\s*\{[\s\S]*display:\s*none/)
  assert.match(settingsControlsCss, /env\(safe-area-inset-top/)
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
