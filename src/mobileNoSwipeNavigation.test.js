import test from 'node:test'
import assert from 'node:assert/strict'
import { access, readFile, readdir } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

const collectRuntimeFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const target = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory)
    if (entry.isDirectory()) files.push(...await collectRuntimeFiles(target))
    else if (/\.(js|jsx)$/.test(entry.name) && !entry.name.endsWith('.test.js')) files.push(target)
  }
  return files
}

test('app shell does not intercept horizontal touch gestures for navigation', async () => {
  const source = await read('./components/AppShell.jsx')
  assert.doesNotMatch(source, /getAdjacentMobileSection/)
  assert.doesNotMatch(source, /getSwipeDirection/)
  assert.doesNotMatch(source, /shouldIgnoreNavigationSwipe/)
  assert.doesNotMatch(source, /handleTouchStart/)
  assert.doesNotMatch(source, /handleTouchEnd/)
  assert.doesNotMatch(source, /onTouchStart=/)
  assert.doesNotMatch(source, /onTouchEnd=/)
})

test('mobile foundation does not block horizontal gestures inside scrollable controls', async () => {
  const css = await read('./mobile-foundation.css')
  assert.doesNotMatch(css, /\.app-main\s*\{[^}]*touch-action:\s*pan-y\s+pinch-zoom/s)
})

test('swipe-navigation helpers and opt-out markers are removed from runtime code', async () => {
  const forbidden = [
    'getAdjacentMobile' + 'Section',
    'get' + 'SwipeDirection',
    'shouldIgnoreNavigation' + 'Swipe',
    'data-navigation-' + 'swipe-block',
    'data-horizontal-' + 'interaction',
  ]
  const files = await collectRuntimeFiles(new URL('./', import.meta.url))
  const leftovers = []
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    for (const token of forbidden) {
      if (source.includes(token)) leftovers.push(`${file.pathname}: ${token}`)
    }
  }
  assert.deepEqual(leftovers, [])
})

test('obsolete swipe integration test file is removed', async () => {
  await assert.rejects(
    access(new URL('./mobile' + 'SwipeNavigation.test.js', import.meta.url)),
    (error) => error?.code === 'ENOENT',
  )
})
