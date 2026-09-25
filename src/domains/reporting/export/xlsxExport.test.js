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

test('XLSX Resumo converts monetary KPIs from cents to formatted reais without changing counts', async () => {
  const { createXlsxWorkbook } = await import('./xlsxExport.js')
  const monetary = {
    salesCents: 12345, averageTicketCents: 2469, receivedCents: 10000,
    receivableCents: 2345, refundsCents: 99, merchandiseRevenueCents: 9000,
    deliveryFeesCents: 3345, discountCents: 120, surchargeCents: 50,
  }
  const workbook = await createXlsxWorkbook({ columns: [], rows: [], summary: { ...monetary, ordersCount: 5 } })
  const summary = workbook.getWorksheet('Resumo')
  const rows = new Map(summary.getSheetValues().filter(Boolean).map((cells, index) => [cells[1], summary.getRow(index + 1)]))
  const labels = {
    salesCents: 'Vendas registradas', averageTicketCents: 'Ticket médio', receivedCents: 'Recebido no período',
    receivableCents: 'A receber', refundsCents: 'Estornos', merchandiseRevenueCents: 'Receita de mercadoria',
    deliveryFeesCents: 'Taxas de entrega', discountCents: 'Descontos', surchargeCents: 'Acréscimos',
  }
  for (const [key, cents] of Object.entries(monetary)) {
    const cell = rows.get(labels[key])?.getCell(2)
    assert.equal(cell?.value, cents / 100, key)
    assert.equal(cell?.numFmt, '"R$" #,##0.00', key)
  }
  assert.equal(rows.get('Pedidos')?.getCell(2).value, 5)
  assert.notEqual(rows.get('Pedidos')?.getCell(2).numFmt, '"R$" #,##0.00')
})
