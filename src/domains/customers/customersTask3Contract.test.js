import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('Customers exposes the composition workspace through its Node-safe public entry', async () => {
  const customers = await import('./index.js')
  assert.equal(typeof customers.CustomersWorkspace, 'function')
})

test('Task 3 removes the legacy Clients owner and App-owned list projection', async () => {
  const legacyClients = new URL('../../pages/Clients.jsx', import.meta.url)
  const app = await read('../../App.jsx')

  assert.equal(existsSync(fileURLToPath(legacyClients)), false)
  assert.doesNotMatch(app, /from ['"]\.\/pages\/Clients['"]/)
  assert.doesNotMatch(app, /clients\.filter\(/)
  assert.doesNotMatch(app, /localeCompare\(/)
  assert.doesNotMatch(app, /filterAndSortClients/)
  assert.match(await read('./ui/Clients.jsx'), /filterAndSortClients/)
})
