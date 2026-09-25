import test from 'node:test'
import assert from 'node:assert/strict'

test('XLSX exporter builds summary and data sheets from the canonical model', async () => {
  const { createXlsxWorkbook } = await import('./xlsxExport.js')
  const workbook = await createXlsxWorkbook({
    view: 'sales', columns: ['Pedido', 'Total'], columnKeys: ['order_number', 'total_cents'], rows: [['1', 1234]],
    filters: { type: 'Entrega', paymentMethod: 'Pix' }, summary: { salesCents: 1234 },
  })
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ['Resumo', 'Dados'])
  const summary = workbook.getWorksheet('Resumo').getSheetValues().flat().filter(Boolean)
  assert.ok(summary.includes('Modalidade'))
  assert.ok(summary.includes('Forma de pagamento'))
  assert.ok(summary.includes('Vendas registradas'))
  assert.equal(workbook.getWorksheet('Dados').getCell('B2').value, 12.34)
})
