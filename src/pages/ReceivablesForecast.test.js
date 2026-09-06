import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('receivables exposes an accessible forecast action backed by seven-day domain forecast', async () => {
  const page = await read('./Receivables.jsx')
  assert.match(page, /aria-label="Previsão de recebimentos"/)
  assert.match(page, /buildReceivablesForecast\(orders, today, 7\)/)
  assert.match(page, /calculateReceivedToday\(movements, today\)/)
})

test('forecast dialog renders overdue today seven days later and received-today as separate text metrics', async () => {
  const dialog = await read('../components/ReceivablesForecastDialog.jsx')
  assert.match(dialog, /Em atraso/)
  assert.match(dialog, /Hoje/)
  assert.match(dialog, /Depois/)
  assert.match(dialog, /Recebido hoje/)
  assert.match(dialog, /forecast\.days\.map/)
  assert.match(dialog, /onSelectDate\(day\.date\)/)
})
