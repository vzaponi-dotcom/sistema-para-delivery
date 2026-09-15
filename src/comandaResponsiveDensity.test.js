import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const css = fs.readFileSync(new URL('./comandas.css', import.meta.url), 'utf8')
const mobileCss = fs.readFileSync(new URL('./mobile-compact-controls.css', import.meta.url), 'utf8')
const marker = '/* Comanda responsive density refinement */'

test('comanda detail keeps the approved compact desktop density', () => {
  const refinement = css.split(marker)[1]
  assert.ok(refinement, 'responsive density refinement block must exist')
  assert.match(refinement, /\.comandas-detail-panel\s*\{[^}]*padding:\s*14px;/s)
  assert.match(refinement, /\.comanda-detail-number\s*\{[^}]*font-size:\s*clamp\(2\.1rem, 6\.5cqi, 3\.6rem\);/s)
  assert.match(refinement, /\.comanda-detail-actions \.button\s*\{[^}]*min-height:\s*44px;/s)
  assert.match(refinement, /\.comanda-detail-secondary-actions \.button\s*\{[^}]*min-height:\s*50px;/s)
})

test('narrow mobile keeps item subtotal and secondary actions on the compact row layout', () => {
  const refinement = css.split(marker)[1]
  assert.ok(refinement, 'responsive density refinement block must exist')
  const narrowStart = refinement.indexOf('@container (max-width: 400px)')
  const mediaStart = refinement.indexOf('@media (max-width: 820px)')
  assert.ok(narrowStart >= 0 && mediaStart > narrowStart, '400px refinement must precede mobile media rules')
  const narrow = refinement.slice(narrowStart, mediaStart)

  assert.match(narrow, /grid-template-columns:\s*38px minmax\(0, 1fr\) minmax\(72px, auto\);/)
  assert.match(narrow, /\.comanda-detail-subtotal\s*\{[^}]*grid-column:\s*auto;[^}]*border-left:\s*1px solid var\(--border\);/s)
  assert.match(narrow, /\.comanda-detail-total\s*\{[^}]*grid-template-columns:\s*auto minmax\(0, 1fr\) auto;/s)
  assert.match(narrow, /\.comanda-detail-secondary-actions\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);/s)
})

test('narrow mobile keeps the COMANDA eyebrow on one compact line', () => {
  assert.match(mobileCss, /@media \(max-width: 400px\)[\s\S]*?\.comanda-detail-eyebrow\s*\{[^}]*font-size:\s*0\.64rem;[^}]*white-space:\s*nowrap;/s)
})

test('mobile detail removes the redundant inner horizontal inset', () => {
  const refinement = css.split(marker)[1]
  assert.match(refinement, /@media \(max-width: 820px\)[\s\S]*?\.comandas-detail-panel\s*\{[^}]*padding:\s*0 0 calc\(20px \+ env\(safe-area-inset-bottom, 0px\)\);/)
})
