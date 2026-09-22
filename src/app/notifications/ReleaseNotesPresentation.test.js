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
