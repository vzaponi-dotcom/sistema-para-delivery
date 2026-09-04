import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = () => readFile(new URL('./OrderDetail.jsx', import.meta.url), 'utf8')

test('order detail renders shared operational timing in the business timezone', async () => {
  const source = await read()
  for (const label of ['Horário desejado', 'Início operacional', 'Tempo até sair para entrega', 'Tempo até finalização']) assert.match(source, new RegExp(label))
  assert.match(source, /getOperationalStartAt/)
  assert.match(source, /getOperationalDurationMinutes/)
  assert.match(source, /FINANCE_TIME_ZONE/)
})

