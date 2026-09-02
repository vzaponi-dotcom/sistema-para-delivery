import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('mobile UX combines bottom navigation swipe blocking and safe areas', async () => {
  const shell = await read('./components/AppShell.jsx')
  const nav = await read('./components/MobileNavigation.jsx')
  const modal = await read('./components/Modal.jsx')
  const foundationCss = await read('./mobile-foundation.css')
  const navCss = await read('./mobile-navigation.css')
  assert.match(shell, /onTouchStart=/)
  assert.match(nav, /BottomSheet/)
  assert.match(modal, /data-navigation-swipe-block/)
  assert.match(foundationCss, /--layer-mobile-nav:\s*60/)
  assert.match(navCss, /z-index:\s*var\(--layer-mobile-nav\)/)
  assert.match(navCss, /safe-area-inset-bottom/)
})

test('desktop sidebar remains while bottom nav is mobile-only', async () => {
  const shell = await read('./components/AppShell.jsx')
  const css = await read('./mobile-navigation.css')
  assert.match(shell, /<Sidebar/)
  assert.match(css, /\.mobile-bottom-nav\s*\{[^}]*display:\s*none/s)
  assert.match(css, /@media\s*\(max-width:\s*820px\)[\s\S]*\.mobile-bottom-nav\s*\{[^}]*display:\s*grid/s)
})
