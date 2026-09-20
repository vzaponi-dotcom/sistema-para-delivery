import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as printing from '../index.js'

test('PrintQueue ownership moves behind the Printing public entry', async () => {
  assert.equal(typeof printing.PrintQueue, 'function')
  const source = await readFile(new URL('./PrintQueue.jsx', import.meta.url), 'utf8').catch(() => null)
  assert.ok(source, 'Printing UI must own PrintQueue.jsx')
  assert.match(source, /getPrintJobs/)
  assert.match(source, /getPrintQueueSummary/)
  assert.doesNotMatch(source, /qz-tray|claimNextPrintJob|claimPrintJob|printQzRawBytes/)
})
