import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('Task 2 removes legacy customer API ownership and App collection mutation', async () => {
  const [legacyApi, app, runtime] = await Promise.all([
    read('../../api/client.js'),
    read('../../App.jsx'),
    read('../../app/runtime/data/useOperationalDataRuntime.js'),
  ])

  assert.doesNotMatch(legacyApi, /export\s+const\s+(createClient|updateClient|deleteClient)\b/)
  assert.doesNotMatch(app, /createClient\s+as\s+createClientApi/)
  assert.doesNotMatch(app, /updateClient\s+as\s+updateClientApi/)
  assert.doesNotMatch(app, /deleteClient\s+as\s+deleteClientApi/)
  assert.doesNotMatch(app, /updateCollection\(['"]clients['"]/)
  assert.match(runtime, /deletedClientId/)
})
