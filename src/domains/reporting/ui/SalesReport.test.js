import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('sales report distinguishes sales from receipts without payment mutation', async () => {
  const source = await readFile(new URL('./views/SalesReport.jsx', import.meta.url), 'utf8')
  assert.match(source, /Vendas registradas/)
  assert.match(source, /Recebido no período/)
  assert.match(source, /Mix por forma de pagamento/)
  assert.doesNotMatch(source, /Registrar pagamento/)
})
