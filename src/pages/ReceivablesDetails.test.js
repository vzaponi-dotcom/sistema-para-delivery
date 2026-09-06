import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

test('receivables keeps OrderDetail as deeper order inspection while the ledger is introduced', () => {
  const page = source('./Receivables.jsx')

  assert.match(page, /import OrderDetail from ['"]\.\.\/components\/OrderDetail['"]/)
  assert.match(page, /const \[detailOrder, setDetailOrder\] = useState\(null\)/)
  assert.match(page, /receivable-ledger-row/)
  assert.match(page, /setDetailOrder\(entry\.order\)/)
  assert.match(page, /detailOrder && <OrderDetail order=\{detailOrder\} currency=\{currency\} onClose=\{\(\) => setDetailOrder\(null\)\} \/>/)
})
