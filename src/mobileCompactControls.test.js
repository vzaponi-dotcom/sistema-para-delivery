import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('mobile compact controls stylesheet is wired from the application entrypoint', async () => {
  const main = await read('./main.jsx')

  assert.match(main, /import '\.\/mobile-compact-controls\.css'/)
})
