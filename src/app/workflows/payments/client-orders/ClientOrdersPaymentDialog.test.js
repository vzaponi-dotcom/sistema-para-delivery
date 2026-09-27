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
