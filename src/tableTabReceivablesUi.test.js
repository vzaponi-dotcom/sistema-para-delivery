import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('./pages/Receivables.jsx', import.meta.url), 'utf8')

test('receivables offers one consolidated payment action for table tabs', () => {
  assert.match(source, /Registrar pagamento da comanda/)
  assert.match(source, /group\.kind === 'table_tab'/)
  assert.match(source, /onRegisterTableTabPayment/)
  assert.match(source, /todos os pedidos pendentes/i)
})
