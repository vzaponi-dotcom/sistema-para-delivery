import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

test('receivables offers order details beside payment and reuses OrderDetail', () => {
  const page = source('./Receivables.jsx')

  assert.match(page, /import OrderDetail from ['"]\.\.\/components\/OrderDetail['"]/)
  assert.match(page, /const \[detailOrder, setDetailOrder\] = useState\(null\)/)
  assert.match(page, /onClick=\{\(\) => setDetailOrder\(order\)\}[\s\S]*?>Ver detalhes<\/Button>/)
  assert.match(page, /onClick=\{\(\) => onRegisterPayment\(order\.id\)\}[\s\S]*?>Registrar pagamento<\/Button>/)
  assert.match(page, /detailOrder && <OrderDetail order=\{detailOrder\} currency=\{currency\} onClose=\{\(\) => setDetailOrder\(null\)\} \/>/)
})
