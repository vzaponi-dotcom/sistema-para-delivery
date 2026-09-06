import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('mobile UX combines bottom navigation, free horizontal gestures and safe areas', async () => {
  const shell = await read('./components/AppShell.jsx')
  const nav = await read('./components/MobileNavigation.jsx')
  const foundationCss = await read('./mobile-foundation.css')
  const navCss = await read('./mobile-navigation.css')

  assert.doesNotMatch(shell, /onTouchStart=/)
  assert.doesNotMatch(shell, /onTouchEnd=/)
  assert.match(nav, /BottomSheet/)
  assert.match(foundationCss, /--layer-mobile-nav:\s*60/)
  assert.match(foundationCss, /--mobile-safe-bottom:\s*env\(safe-area-inset-bottom,\s*0px\)/)
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

test('kitchen arrival animation honors reduced-motion preference', async () => {
  const css = await read('./order-operations-compact.css')
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.kitchen-ticket-highlighted\s*\{[^}]*animation:\s*none/s)
})
