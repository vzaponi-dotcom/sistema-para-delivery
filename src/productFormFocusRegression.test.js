import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('modal focus lifecycle does not restart when an inline onClose callback changes during typing', async () => {
  const modal = await read('./components/Modal.jsx')

  assert.match(modal, /const onCloseRef = useRef\(onClose\)/)
  assert.match(modal, /onCloseRef\.current = onClose/)
  assert.match(modal, /onCloseRef\.current\(\)/)
  assert.match(modal, /useEffect\(\(\) => \{[\s\S]*previousFocus\.current = document\.activeElement[\s\S]*\}, \[\]\)/s)
  assert.doesNotMatch(modal, /previousFocus\.current = document\.activeElement[\s\S]*\}, \[onClose\]\)/s)
})

test('new product form normalizes its initial price to zero while editing keeps the existing price', async () => {
  const form = await read('./components/ProductForm.jsx')
  const app = await read('./App.jsx')

  assert.match(form, /const initializedNewPriceRef = useRef\(false\)/)
  assert.match(form, /if \(editing \|\| initializedNewPriceRef\.current\) return/)
  assert.match(form, /price: formatBRLCurrencyValue\(0\)/)
  assert.match(app, /price: formatBRLCurrencyValue\(product\.price\)/)
})
