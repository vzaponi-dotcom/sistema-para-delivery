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


test('XLSX detail summary uses official KPIs, operation identity and human filter labels', async () => {
  const { createXlsxWorkbook } = await import('./xlsxExport.js')
  const workbook = await createXlsxWorkbook({
    view: 'detail',
    operation: { id: 'business-a', name: 'Amor & Sabor', slug: 'amor-sabor' },
    columns: ['Pedido', 'Total'],
    columnKeys: ['order_number', 'total_cents'],
    rows: [[183, 43200]],
    filters: { receivable: 'unpaid', search: 'Fernanda' },
    summary: {
      total: 16,
      page: 1,
      pageSize: 25,
      totalPages: 1,
      summary: {
        ordersCount: 16,
        salesCents: 113200,
        averageTicketCents: 7075,
        cancellationRate: 0,
      },
    },
  })
  const values = workbook.getWorksheet('Resumo').getSheetValues().flat().filter((value) => value !== undefined && value !== null)
  for (const expected of ['Operação', 'Amor & Sabor', 'Recebível', 'A receber', 'Busca', 'Fernanda', 'Pedidos', 'Faturamento total', 'Ticket médio', 'Taxa de cancelamento']) {
    assert.ok(values.includes(expected), expected)
  }
  assert.equal(values.includes('unpaid'), false)
  assert.equal(values.includes('pageSize'), false)
  assert.equal(values.includes('totalPages'), false)
  const summary = workbook.getWorksheet('Resumo')
  const rowByLabel = new Map(summary.getSheetValues().filter(Boolean).map((cells, index) => [cells[1], summary.getRow(index + 1)]))
  assert.equal(rowByLabel.get('Faturamento total')?.getCell(2).value, 1132)
  assert.equal(rowByLabel.get('Ticket médio')?.getCell(2).value, 70.75)
  assert.equal(rowByLabel.get('Taxa de cancelamento')?.getCell(2).value, 0)
})
