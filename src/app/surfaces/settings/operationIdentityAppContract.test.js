import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

test('App marks operation identity as implemented and mounts it through the shared Settings surface', async () => {
  const source = await readFile(new URL('../../../App.jsx', import.meta.url), 'utf8')
  assert.match(source, /IMPLEMENTED_DESTINATIONS[\s\S]*settings-business-profile/)
  assert.match(source, /activeTab === 'settings-business-profile'/)
})
