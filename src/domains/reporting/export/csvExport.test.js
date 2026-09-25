import test from 'node:test'
import assert from 'node:assert/strict'

test('CSV has UTF-8 BOM and escaped official rows', async () => {
  const { exportCsv } = await import('./csvExport.js')
  assert.equal(exportCsv({ columns: ['Pedido'], rows: [['"1"']] }), '\uFEFFPedido\r\n"""1"""')
})
