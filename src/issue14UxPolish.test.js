import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const tables = fs.readFileSync(new URL('./domains/table-service/ui/Tables.jsx', import.meta.url), 'utf8')
const tableStyles = fs.readFileSync(new URL('./table-management.css', import.meta.url), 'utf8')
const detail = fs.readFileSync(new URL('./domains/finance/ui/ReceivableDetail.jsx', import.meta.url), 'utf8')

test('tables routes occupied-table work to the protected Comandas flow', () => {
  assert.match(tables, /occupied && canOpenComanda && table\.openTableTab\?\.id/)
  assert.match(tables, /onOpenComanda\?\.\(\{ tableId: table\.id, tableTabId: table\.openTableTab\.id \}\)/)
  assert.match(tables, />Ver comanda<\/Button>/)
  assert.match(tables, /className="table-management-danger"/)
})

test('tables uses a compact card layout while preserving mobile touch targets', () => {
  assert.match(tables, /<Modal title=\{editor\.type === 'create' \? 'Nova mesa'/)
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

test('receivable detail keeps ordinary payment actions', () => {
  assert.match(detail, /className="receivable-detail-total"/)
  assert.match(detail, /Registrar recebimento/)
  assert.match(detail, /Definir data prometida/)
})


test('Mesiva keeps occupied table cards neutral and lets the occupancy badge carry status', () => {
  assert.match(
    tableStyles,
    /:root\[data-visual-theme=['"]mesiva['"]\] \.table-management-card\.occupied\s*\{[^}]*border-color:\s*var\(--border\);/s,
  )
  assert.match(tableStyles, /\.table-status\.occupied \{[^}]*background: var\(--warning-soft\);[^}]*color: var\(--warning\);/s)
})
