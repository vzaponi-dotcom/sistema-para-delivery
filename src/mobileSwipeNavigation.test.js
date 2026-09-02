import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('app shell wires mobile-only deliberate swipes to adjacent sections', async () => {
  const source = await read('./components/AppShell.jsx')
  assert.match(source, /getAdjacentMobileSection/)
  assert.match(source, /getSwipeDirection/)
  assert.match(source, /shouldIgnoreNavigationSwipe/)
  assert.match(source, /matchMedia\('\(max-width: 820px\)'\)/)
  assert.match(source, /onTouchStart=/)
  assert.match(source, /onTouchEnd=/)
  assert.match(source, /activeTab === 'new-order'/)
})
