import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('./pages/Receivables.jsx', import.meta.url), 'utf8')
const styles = fs.readFileSync(new URL('./receivables.css', import.meta.url), 'utf8')

test('receivables offers one consolidated payment action for table tabs', () => {
  assert.match(source, /Registrar pagamento da comanda/)
  assert.match(source, /group\.kind === 'table_tab'/)
  assert.match(source, /onRegisterTableTabPayment/)
  assert.match(source, /todos os pedidos pendentes/i)
})

test('table tab payment action uses a high-contrast dedicated button style', () => {
  assert.match(source, /className="table-tab-payment-action-button"/)
  assert.match(styles, /\.table-tab-payment-action-button\s*\{[^}]*background:\s*var\(--danger\)/s)
  assert.match(styles, /\.table-tab-payment-action-button\s*\{[^}]*color:\s*#fff/s)
  assert.match(styles, /\.table-tab-payment-action-button:hover:not\(:disabled\)/)
  assert.match(styles, /\.table-tab-payment-action-button:focus-visible/)
})
