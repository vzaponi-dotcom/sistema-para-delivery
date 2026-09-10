import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const tables = fs.readFileSync(new URL('./pages/Tables.jsx', import.meta.url), 'utf8')
const tableStyles = fs.readFileSync(new URL('./table-management.css', import.meta.url), 'utf8')
const detail = fs.readFileSync(new URL('./components/ReceivableDetail.jsx', import.meta.url), 'utf8')

test('tables keeps occupied-table transfer as the primary operational action', () => {
  const occupiedActions = tables.match(/<div className="table-occupied-actions">([\s\S]*?)<\/div>/)?.[1] ?? ''

  assert.match(occupiedActions, /className="table-transfer-primary"/)
  assert.match(occupiedActions, />Transferir comanda<\/Button>/)
  assert.doesNotMatch(occupiedActions, /variant="secondary"/)
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

test('receivable detail keeps ordinary payment actions without table-tab controls', () => {
  assert.match(detail, /className="receivable-detail-total"/)
  assert.match(detail, /Registrar recebimento/)
  assert.match(detail, /Definir data prometida/)
  assert.doesNotMatch(detail, /table_tab/)
  assert.doesNotMatch(detail, /Registrar pagamento da comanda/)
})
