import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const receivables = fs.readFileSync(new URL('./pages/Receivables.jsx', import.meta.url), 'utf8')
const detail = fs.readFileSync(new URL('./components/ReceivableDetail.jsx', import.meta.url), 'utf8')
const styles = fs.readFileSync(new URL('./receivables.css', import.meta.url), 'utf8')

test('receivables keeps table tabs consolidated and delegates payment through the detail action', () => {
  assert.match(receivables, /buildPendingReceivableEntries/)
  assert.match(detail, /entry\.kind === 'table-tab'/)
  assert.match(detail, /Pagamento agregado da comanda/)
  assert.match(detail, /pedido\(s\) em aberto/i)
  assert.match(detail, /Registrar recebimento/)
  assert.match(detail, /!isTableTab && onEditPromise/)
})

test('table tab detail uses the shared primary payment action without the obsolete danger treatment', () => {
  assert.match(detail, /className="btn btn-primary"/)
  assert.doesNotMatch(detail, /table-tab-payment-action-button/)
  assert.doesNotMatch(styles, /\.table-tab-payment-action-button/)
})
