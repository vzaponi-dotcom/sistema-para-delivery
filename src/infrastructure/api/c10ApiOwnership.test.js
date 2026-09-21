import test from 'node:test'
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8')

test('runtime and effective-config owners use final infrastructure API paths', async () => {
  const [runtime, effective, sessionRecovery] = await Promise.all([
    read('../../app/runtime/data/useOperationalDataRuntime.js'),
    read('../../app/useEffectiveBusinessConfig.js'),
    read('../../settingsSessionRecovery.test.js'),
  ])

  assert.match(runtime, /from ['"]\.\.\/\.\.\/\.\.\/infrastructure\/api\/bootstrapApi\.js['"]/)
  assert.doesNotMatch(runtime, /api\/client\.js/)
  assert.match(effective, /from ['"]\.\.\/infrastructure\/api\/effectiveConfigApi\.js['"]/)
  assert.doesNotMatch(effective, /api\/effectiveConfigClient\.js/)
  assert.match(sessionRecovery, /from ['"]\.\/infrastructure\/auth\/sessionApi\.js['"]/)
  assert.doesNotMatch(sessionRecovery, /api\/client\.js/)
})

test('legacy API facade production files are physically absent', async () => {
  for (const path of [
    '../../api/client.js',
    '../../api/effectiveConfigClient.js',
  ]) {
    await assert.rejects(access(new URL(path, import.meta.url)), (error) => error?.code === 'ENOENT')
  }
})
