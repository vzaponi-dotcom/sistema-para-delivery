import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const srcDir = fileURLToPath(new URL('.', import.meta.url))

async function jsxFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return jsxFiles(path)
    return entry.isFile() && entry.name.endsWith('.jsx') ? [path] : []
  }))
  return nested.flat()
}

test('all app-facing JSX uses SystemSelect instead of native select', async () => {
  const offenders = []
  for (const path of await jsxFiles(srcDir)) {
    const source = await readFile(path, 'utf8')
    if (/<select\b/.test(source)) offenders.push(path.slice(srcDir.length))
  }
  assert.deepEqual(offenders, [])
})

test('App and Clients use the shared SystemSelect', async () => {
  const app = await readFile(join(srcDir, 'App.jsx'), 'utf8')
  const clients = await readFile(join(srcDir, 'pages/Clients.jsx'), 'utf8')
  assert.match(app, /import SystemSelect/)
  assert.match(clients, /import SystemSelect/)
})
