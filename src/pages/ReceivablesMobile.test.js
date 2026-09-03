import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('receivables payment actions keep comfortable touch targets on narrow screens', async () => {
  const css = await read('../receivables.css')

  assert.match(css, /\.receivable-order-row \.button\s*\{[^}]*min-height:\s*(?:44px|var\(--mobile-touch-target(?:,\s*44px)?\))/s)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.receivable-order-actions\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*1fr/s)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.receivable-order-actions \.button\s*\{[^}]*width:\s*100%/s)
})

test('receivables labels and order summaries wrap instead of clipping at mobile widths', async () => {
  const css = await read('../receivables.css')

  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.receivable-client-copy strong\s*\{[^}]*overflow-wrap:\s*anywhere/s)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.receivable-order-main span\s*\{[^}]*white-space:\s*normal[^}]*overflow-wrap:\s*anywhere/s)
})

test('table tab payment summary and modal footer stack safely on mobile', async () => {
  const receivablesCss = await read('../receivables.css')
  const foundation = await read('../mobile-foundation.css')

  assert.match(receivablesCss, /@media\s*\(max-width:\s*640px\)[\s\S]*\.table-tab-payment-summary\s*\{[^}]*grid-template-columns:\s*1fr/s)
  assert.match(foundation, /@media\s*\(max-width:\s*640px\)[\s\S]*\.modal-footer\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*1fr/s)
  assert.match(foundation, /\.modal-footer \.button\s*\{[^}]*width:\s*100%[^}]*min-height:\s*48px/s)
})

test('payment flows keep the shared modal select architecture', async () => {
  const page = await read('./Receivables.jsx')
  const app = await read('../App.jsx')

  assert.match(page, /<Modal[\s\S]*Registrar pagamento da comanda/)
  assert.match(page, /<SystemSelect[\s\S]*label="Forma de pagamento da comanda"/)
  assert.match(app, /<Modal title="Registrar pagamento"[\s\S]*<SystemSelect[\s\S]*label="Forma de pagamento"/)
})
