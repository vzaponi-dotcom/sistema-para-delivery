import test from 'node:test'
import assert from 'node:assert/strict'

test('XLSX exporter builds summary and data sheets from the canonical model', async () => {
  const { createXlsxWorkbook } = await import('./xlsxExport.js')
  const workbook = await createXlsxWorkbook({ columns: ['Pedido'], rows: [['1']] })
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ['Resumo', 'Dados'])
})
