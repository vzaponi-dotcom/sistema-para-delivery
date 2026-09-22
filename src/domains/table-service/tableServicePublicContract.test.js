import assert from 'node:assert/strict'
import test from 'node:test'
import * as tableService from './index.js'

test('table-service public contract exposes only real external consumers', () => {
  assert.deepEqual(
    Object.keys(tableService).sort(),
    [
      'Comandas',
      'LocalTableSelector',
      'Tables',
      'getOpenComandaCount',
      'resolveOpenComanda',
      'useComandaSelection',
      'useTableServiceCommands',
    ].sort(),
  )
})
