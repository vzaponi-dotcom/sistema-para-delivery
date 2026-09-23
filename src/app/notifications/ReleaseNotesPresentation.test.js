import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const css = await readFile(new URL('../../notification-center.css', import.meta.url), 'utf8')

const rule = (selector) => css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*\\{([^}]+)\\}`, 's'))?.[1] ?? ''

test('release notes use the approved editorial layout with semantic theme tokens', () => {
  const content = rule('.release-notes-content')
  const summary = rule('.release-notes-summary')
  const list = rule('.release-notes-list')
  const item = rule('.release-notes-item')
  const icon = rule('.release-notes-item-icon')
  const footer = rule('.release-notes-brand')

  assert.match(content, /color:\s*var\(--text\)/)
  assert.match(summary, /color:\s*var\(--text-soft\)/)
  assert.match(list, /list-style:\s*none/)
  assert.match(item, /border-(?:top|bottom):\s*1px solid var\(--border\)/)
  assert.match(icon, /background:\s*var\(--surface-soft\)/)
  assert.match(icon, /color:\s*var\(--primary\)/)
  assert.match(footer, /color:\s*var\(--muted\)/)
})

test('release notes responsive contract contains long content without horizontal overflow', () => {
  const content = rule('.release-notes-content')
  const itemCopy = rule('.release-notes-item-copy')
  const mobileContract = css.match(/@media\s*\([^)]*max-width:\s*820px[^)]*\)\s*\{([\s\S]*)\}\s*$/)?.[1] ?? ''

  assert.match(content, /min-width:\s*0/)
  assert.match(content, /overflow-wrap:\s*anywhere/)
  assert.match(itemCopy, /min-width:\s*0/)
  assert.match(mobileContract, /\.release-notes-modal/)
  assert.match(mobileContract, /\.release-notes-item/)
})

test('release item icon removes the inline svg baseline and centers a fixed-size glyph', () => {
  const icon = rule('.release-notes-item-icon')
  const glyph = css.match(/\.release-notes-item-icon svg,\s*\.release-notes-item-icon \.icon\s*\{([^}]+)\}/s)?.[1] ?? ''

  assert.match(icon, /display:\s*inline-flex/)
  assert.match(icon, /align-items:\s*center/)
  assert.match(icon, /justify-content:\s*center/)
  assert.match(icon, /line-height:\s*0/)
  assert.match(glyph, /display:\s*block/)
  assert.match(glyph, /width:\s*20px/)
  assert.match(glyph, /height:\s*20px/)
})


test('release item icon container is vertically centered against multi-line copy', () => {
  const icon = rule('.release-notes-item-icon')
  assert.match(icon, /align-self:\s*center/)
})


test('release tour keeps a large visual surface and responsive mobile navigation', () => {
  const modal = rule('.release-notes-tour-modal')
  const media = rule('.release-tour-media')
  const copy = rule('.release-tour-copy')
  const nav = rule('.release-tour-navigation')
  const mobileContract = css.match(/@media\s*\([^)]*max-width:\s*820px[^)]*\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''

  assert.match(modal, /width:\s*min\(920px, calc\(100vw - 32px\)\)/)
  assert.match(media, /aspect-ratio:\s*16\s*\/\s*8\.5/)
  assert.match(media, /overflow:\s*hidden/)\n  assert.match(css, /\.release-tour-media img[\\s\\S]*object-fit:\\s*contain/)
  assert.match(copy, /grid-template-columns:\s*42px minmax\(0, 1fr\)/)
  assert.match(nav, /grid-template-columns:\s*minmax\(120px, 1fr\) auto minmax\(120px, 1fr\)/)
  assert.match(css, /\.release-tour-media-nav[\s\S]*@media \(max-width: 820px\)[\s\S]*\.release-tour-media-nav \{\s*display:\s*none;/)
  assert.match(css, /@media \(max-width: 420px\)/)
})


test('release tour puts the release heading above media and the slide title below it', async () => {
  const source = await readFile(new URL('./ReleaseNotesModal.jsx', import.meta.url), 'utf8')
  assert.match(source, /<h3>\{notification\.title\}<\/h3>/)
  assert.match(source, /<p>\{notification\.summary\}<\/p>/)
  assert.match(source, /release-tour-copy-text/)
  assert.match(source, /<h4>\{slide\.title\}<\/h4>/)
  assert.match(source, /data-horizontal-interaction="true"/)
})
