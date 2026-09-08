import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const tables = fs.readFileSync(new URL('./pages/Tables.jsx', import.meta.url), 'utf8')
const tableStyles = fs.readFileSync(new URL('./table-management.css', import.meta.url), 'utf8')
const detail = fs.readFileSync(new URL('./components/ReceivableDetail.jsx', import.meta.url), 'utf8')
const receivablesStyles = fs.readFileSync(new URL('./receivables.css', import.meta.url), 'utf8')

test('tables keeps occupied-table transfer as the primary operational action', () => {
  assert.match(tables, /className="table-transfer-primary"/)
  assert.match(tables, /table-occupied-actions[\s\S]*?<Button[^>]*className="table-transfer-primary"[^>]*>Transferir comanda<\/Button>/)
  assert.doesNotMatch(tables, /className="table-transfer-primary"[^>]*variant="secondary"/)
  assert.match(tables, /className="table-deactivate-action"[^>]*variant="secondary"/)
})

test('tables uses a compact card layout while preserving mobile touch targets', () => {
  assert.match(tables, /table-create-card table-create-card-compact/)
  assert.match(tables, /table-management-card[^'"`]*\$\{occupied \? ' occupied' : ''\}/)
  assert.match(tableStyles, /\.table-create-card \{ padding: 14px 16px; \}/)
  assert.match(tableStyles, /\.table-management-card \{[^}]*padding: 14px 16px;/s)
  assert.match(tableStyles, /\.icon-button \{[^}]*width: 44px;[^}]*min-width: 44px;[^}]*min-height: 44px;/s)
  assert.match(tableStyles, /@media \(max-width: 640px\)[\s\S]*\.table-create-form \{[^}]*grid-template-columns: minmax\(0, 1fr\) auto;/)
})

test('table status styling gives occupancy stronger hierarchy than activation state', () => {
  assert.match(tableStyles, /\.table-status\.active \{[^}]*background: var\(--surface-strong\);[^}]*color: var\(--text-soft\);/s)
  assert.match(tableStyles, /\.table-status\.free \{[^}]*background: var\(--success-soft\);[^}]*color: var\(--success\);/s)
  assert.match(tableStyles, /\.table-status\.occupied \{[^}]*background: var\(--warning-soft\);[^}]*color: var\(--warning\);/s)
})

test('table-tab detail separates total, order subtotal, item quantity and final payment action', () => {
  assert.match(detail, /className="receivable-table-tab-total"/)
  assert.match(detail, /<span>Total da comanda<\/span>/)
  assert.match(detail, /className="receivable-table-tab-order-subtotal"/)
  assert.match(detail, /<span>Subtotal<\/span>/)
  assert.match(detail, /className="receivable-table-tab-item-quantity">\{item\.quantity\}x<\/span>/)
  assert.match(detail, /className="receivable-table-tab-item-content"/)
  assert.match(detail, /className="receivable-table-tab-payment-footer"/)
  assert.match(detail, /Confira os pedidos antes de receber a comanda\./)
  assert.equal((detail.match(/Registrar pagamento da comanda/g) || []).length, 1)
})

test('table-tab detail styles keep grouped orders readable on small screens and both themes', () => {
  assert.match(receivablesStyles, /\.receivable-table-tab-order \{[^}]*background: var\(--surface\);/s)
  assert.match(receivablesStyles, /\.receivable-table-tab-item \{[^}]*grid-template-columns: auto minmax\(0, 1fr\);/s)
  assert.match(receivablesStyles, /\.receivable-table-tab-item-quantity \{[^}]*background: var\(--primary-soft\);[^}]*color: var\(--primary\);/s)
  assert.match(receivablesStyles, /@media \(max-width: 640px\)[\s\S]*\.receivable-table-tab-heading \{[^}]*flex-direction: column;/)
  assert.match(receivablesStyles, /@media \(max-width: 640px\)[\s\S]*\.receivable-table-tab-total \{[^}]*width: 100%;/)
})
