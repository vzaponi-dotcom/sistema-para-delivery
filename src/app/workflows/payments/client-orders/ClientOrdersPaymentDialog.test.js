import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('client orders payment dialog reuses the shared payment composition editor', async () => {
  const dialog = await read('./ClientOrdersPaymentDialog.jsx')
  assert.match(dialog, /<Modal title="Registrar pagamento"/)
  assert.match(dialog, /dialog\.clientName/)
  assert.match(dialog, /dialog\.orders\.map/)
  assert.match(dialog, /formatOrderDisplayNumber/)
  assert.match(dialog, /<PaymentCompositionEditor/)
  assert.match(dialog, /totalCents=\{dialog\.totalCents\}/)
  assert.match(dialog, /Confirmar recebimento/)
  assert.match(dialog, /!dialog\.composition\.valid/)
})

test('App owns the client-orders payment workflow and closes it with session payment state', async () => {
  const app = await read('../../../../App.jsx')
  assert.match(app, /useClientOrdersPaymentWorkflow/)
  assert.match(app, /ClientOrdersPaymentDialog/)
  assert.match(app, /const clientOrdersPayment = useClientOrdersPaymentWorkflow/)
  assert.match(app, /clientOrdersPayment\.close\(\)/)
  assert.match(app, /clientOrdersPayment\.dialog && <ClientOrdersPaymentDialog/)
})


test('client orders payment summary formats selected orders as a responsive semantic list', async () => {
  const dialog = await read('./ClientOrdersPaymentDialog.jsx')
  const css = await read('./client-orders-payment.css')

  assert.match(dialog, /import '\.\/client-orders-payment\.css'/)
  assert.match(dialog, /className="client-orders-payment-summary"/)
  assert.match(dialog, /className="client-orders-payment-summary-label"/)
  assert.match(dialog, /<ul className="client-orders-payment-summary-list"/)
  assert.match(dialog, /<li key=\{order\.id\} className="client-orders-payment-summary-item">/)
  assert.match(dialog, /className="client-orders-payment-summary-order"/)
  assert.match(dialog, /className="client-orders-payment-summary-amount"/)

  assert.match(css, /\.client-orders-payment-summary-list\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,/)
  assert.match(css, /\.client-orders-payment-summary-item\s*\{[\s\S]*justify-content:\s*space-between/)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.client-orders-payment-summary-list\s*\{[\s\S]*grid-template-columns:\s*1fr/)
})
