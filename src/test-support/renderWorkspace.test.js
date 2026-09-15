import assert from 'node:assert/strict'
import test from 'node:test'
import { access, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { workspaceHarness } from './renderWorkspace.js'

test('workspace harness caches are exclusive and teardown removes only the owned cache', async () => {
  const cleanups = []
  const context = { after: (cleanup) => cleanups.push(cleanup) }
  let first, second
  try {
    first = await workspaceHarness(context)
    second = await workspaceHarness(context)
    assert.notEqual(first.cacheDir, second.cacheDir, 'two live harnesses must not share a Vite cache')
    await writeFile(join(first.cacheDir, 'owner'), 'first')
    await writeFile(join(second.cacheDir, 'owner'), 'second')
    await cleanups.pop()()
    await assert.rejects(access(second.cacheDir), { code: 'ENOENT' })
    assert.equal(await readFile(join(first.cacheDir, 'owner'), 'utf8'), 'first')
    await cleanups.pop()()
    await assert.rejects(access(first.cacheDir), { code: 'ENOENT' })
  } finally {
    while (cleanups.length) await cleanups.pop()()
  }
})

test('workspace harness does not watch project files or schedule watcher timers', async (t) => {
  const harness = await workspaceHarness(t)
  await harness.load('/src/App.jsx')
  assert.deepEqual(harness.watchedPaths(), [], 'filesystem watchers must not contaminate App lifecycle observations')
})
