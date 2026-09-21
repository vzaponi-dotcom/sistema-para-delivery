import test from 'node:test'
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('Task 2 removes legacy customer API ownership and App collection mutation', async () => {
  const [app, runtime] = await Promise.all([
    read('../../App.jsx'),
    read('../../app/runtime/data/useOperationalDataRuntime.js'),
  ])

  await assert.rejects(access(new URL('../../api/client.js', import.meta.url)), (error) => error?.code === 'ENOENT')
  assert.doesNotMatch(app, /createClient\s+as\s+createClientApi/)
  assert.doesNotMatch(app, /updateClient\s+as\s+updateClientApi/)
  assert.doesNotMatch(app, /deleteClient\s+as\s+deleteClientApi/)
  assert.doesNotMatch(app, /updateCollection\(['"]clients['"]/)
  assert.match(runtime, /deletedClientId/)
})
