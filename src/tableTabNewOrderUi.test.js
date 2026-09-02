import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('./pages/NewOrder.jsx', import.meta.url), 'utf8')

test('new order shows active table tab context without sending tab id', () => {
  assert.match(source, /tableTabs/)
  assert.match(source, /comanda aberta/)
  assert.doesNotMatch(source, /customerIdentity:[\s\S]*tableTabId/)
})
