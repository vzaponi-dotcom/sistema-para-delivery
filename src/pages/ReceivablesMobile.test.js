import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('receivables ledger keeps comfortable touch targets and horizontal filters on mobile', async () => {
  const css = await read('../receivables.css')

  assert.match(css, /\.receivable-ledger-row\s*\{[^}]*min-height:\s*(?:44px|[4-9]\dpx)/s)
  assert.match(css, /\.receivables-filter-strip\s*\{[^}]*overflow-x:\s*auto/s)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.receivable-ledger-table-action\s*\{[^}]*min-height:\s*44px/s)
})

test('receivables ledger labels and order summaries wrap instead of clipping at narrow widths', async () => {
  const css = await read('../receivables.css')

  assert.match(css, /\.receivable-ledger-main strong\s*\{[^}]*overflow-wrap:\s*anywhere/s)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.receivable-ledger-main > span[^}]*\{[^}]*white-space:\s*normal[^}]*overflow-wrap:\s*anywhere/s)
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

test('receivables mobile detail reuses the portal-backed shared BottomSheet', async () => {
  const page = await read('./Receivables.jsx')
  const sheet = await read('../components/BottomSheet.jsx')

  assert.match(page, /import BottomSheet/)
  assert.match(page, /<BottomSheet[\s\S]*Detalhes do recebimento/)
  assert.match(sheet, /createPortal/)
  assert.match(sheet, /role="dialog"/)
})

test('quick payment FAB stays above the mobile navigation and safe area', async () => {
  const css = await read('../receivables.css')
  const page = await read('./Receivables.jsx')

  assert.match(page, /className="receivables-payment-fab"/)
  assert.match(page, /aria-label="Registrar recebimento"/)
  assert.match(css, /@media\s*\(max-width:\s*820px\)[\s\S]*\.receivables-payment-fab\s*\{[^}]*position:\s*fixed[^}]*right:\s*var\(--mobile-page-inline\)[^}]*bottom:\s*calc\(var\(--mobile-bottom-nav-height\)\s*\+\s*var\(--mobile-safe-bottom\)\s*\+\s*var\(--mobile-floating-gap\)\)[^}]*z-index:\s*var\(--layer-floating-action\)[^}]*min-height:\s*48px/s)
  assert.match(css, /@media\s*\(min-width:\s*821px\)[\s\S]*\.receivables-payment-fab\s*\{[^}]*display:\s*none/s)
})

test('receivables hardens desktop detail, money wrapping, focus and reduced motion', async () => {
  const css = await read('../receivables.css')

  assert.match(css, /@media\s*\(min-width:\s*960px\)[\s\S]*\.receivables-detail-panel\s*\{[^}]*position:\s*sticky[^}]*max-height:\s*calc\(100dvh\s*-\s*36px\)[^}]*overflow-y:\s*auto/s)
  assert.match(css, /\.receivable-ledger-amount\s*\{[^}]*white-space:\s*nowrap/s)
  assert.match(css, /\.receivable-ledger-row:focus-visible[\s\S]*\.receivables-summary-card:focus-visible[\s\S]*\.receivables-filter-strip button:focus-visible[\s\S]*\.receivables-payment-fab:focus-visible[\s\S]*\.receivables-forecast-row:focus-visible\s*\{/s)
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.receivable-ledger-row[\s\S]*\.receivables-summary-card[\s\S]*\.receivables-payment-fab[\s\S]*\.receivables-forecast-bar[\s\S]*transition:\s*none\s*!important/s)
})
