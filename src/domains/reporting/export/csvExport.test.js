import test from 'node:test'
import assert from 'node:assert/strict'

test('CSV has UTF-8 BOM and escaped official rows', async () => {
  const { exportCsv } = await import('./csvExport.js')
  assert.equal(exportCsv({ columns: ['Pedido'], rows: [['"1"']] }), '\uFEFFPedido\r\n"""1"""')
})


test('reporting CSV metadata identifies operation and uses human filter labels', async () => {
  const { exportReportingCsv } = await import('./csvExport.js')
  const csv = exportReportingCsv({
    title: 'Centro de Relatórios',
    operation: { name: 'Amor & Sabor' },
    period: { from: '2026-09-01', to: '2026-09-25' },
    generatedAt: '2026-09-25T15:00:00Z',
    timezone: 'America/Sao_Paulo',
    filters: { receivable: 'unpaid', search: 'Fernanda', paymentMethod: 'pix', view: 'detail', page: 1, pageSize: 25 },
    columns: ['Pedido'],
    columnKeys: ['order_number'],
    rows: [[183]],
  })
  assert.match(csv, /Operação,Amor & Sabor/)
  assert.match(csv, /Recebível,A receber/)
  assert.match(csv, /Busca,Fernanda/)
  assert.match(csv, /Forma de pagamento,Pix/)
  assert.doesNotMatch(csv, /,unpaid(?:\r|\n|$)/)
})
