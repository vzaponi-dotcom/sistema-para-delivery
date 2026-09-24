import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

test('business profile save uses the existing global write guard without adding an offline queue', async () => {
  const [app, surface, policy] = await Promise.all([
    readFile(new URL('../../../App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../SettingsSurface.jsx', import.meta.url), 'utf8'),
    readFile(new URL('./businessProfilePolicy.js', import.meta.url), 'utf8'),
  ])

  assert.match(app, /<SettingsSurface[^>]*writesBlocked=\{writesBlocked\}/s)
  assert.match(surface, /writesBlocked/)
  assert.match(surface, /businessProfile[\s\S]*writesBlocked/s)
  assert.doesNotMatch(policy, /localStorage|sessionStorage|indexedDB|queue/i)
})
