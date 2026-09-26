import test from 'node:test'
import assert from 'node:assert/strict'

test('XLSX exporter builds summary and data sheets from the canonical model', async () => {
  const { createXlsxWorkbook } = await import('./xlsxExport.js')
  const workbook = await createXlsxWorkbook({
    view: 'sales', columns: ['Pedido', 'Total'], columnKeys: ['order_number', 'total_cents'], rows: [['1', 1234]],
    filters: { type: 'Entrega', paymentMethod: 'Pix' }, summary: { salesCents: 1234 },
  })
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ['Pedidos', 'Resumo'])
  const summary = workbook.getWorksheet('Resumo').getSheetValues().flat().filter(Boolean)
  assert.ok(summary.includes('Modalidade'))
  assert.ok(summary.includes('Forma de pagamento'))
  assert.ok(summary.includes('Vendas registradas'))
  assert.equal(workbook.getWorksheet('Pedidos').getCell('B2').value, 12.34)
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
  for (const expected of ['Operação', 'Amor & Sabor', 'Recebível', 'A receber', 'Busca', 'Fernanda', 'Pedidos no período', 'Faturamento total', 'Ticket médio', 'Taxa de cancelamento']) {
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


test('XLSX Pedidos is the primary sheet and preserves detailed order fields as typed cells', async () => {
  const { createXlsxWorkbook } = await import('./xlsxExport.js')
  const workbook = await createXlsxWorkbook({
    view: 'overview',
    operation: { name: 'Amor & Sabor' },
    columns: ['Pedido', 'Data', 'Data e hora', 'Cliente', 'Telefone', 'Modalidade', 'Agendamento', 'Status', 'Subtotal', 'Taxa de entrega', 'Valor do ajuste', 'Total', 'Recebido', 'Pendente', 'Situação financeira', 'Forma de pagamento', 'Promessa de pagamento', 'Duração (min)', 'Prazo'],
    columnKeys: ['order_number', 'order_date', 'created_at', 'client_name_snapshot', 'client_phone_snapshot', 'type', 'scheduleLabel', 'status', 'subtotal_cents', 'delivery_fee_cents', 'adjustment_amount_cents', 'total_cents', 'paidCents', 'pendingCents', 'paymentState', 'payment_label', 'promised_payment_date', 'durationMinutes', 'onTime'],
    rows: [[42, '2026-09-10', '2026-09-10T15:30:00Z', 'Ana', '11999999999', 'Entrega', 'Agendado', 'Finalizado', 9000, 1000, 0, 10000, 10000, 0, 'Pago', 'Pix + Dinheiro', '2026-09-11', 35, true]],
    rowCount: 1,
    filters: {},
    summary: {},
  })

  assert.equal(workbook.worksheets[0].name, 'Pedidos')
  const sheet = workbook.getWorksheet('Pedidos')
  assert.equal(sheet.getCell('A2').value, 42)
  assert.equal(sheet.getCell('D2').value, 'Ana')
  assert.equal(sheet.getCell('E2').value, '11999999999')
  assert.equal(sheet.getCell('F2').value, 'Entrega')
  assert.equal(sheet.getCell('G2').value, 'Agendado')
  assert.equal(sheet.getCell('L2').value, 100)
  assert.equal(sheet.getCell('L2').numFmt, '"R$" #,##0.00')
  assert.equal(sheet.getCell('P2').value, 'Pix + Dinheiro')
  assert.equal(sheet.getCell('S2').value, 'No prazo')
  assert.ok(sheet.autoFilter)
})
