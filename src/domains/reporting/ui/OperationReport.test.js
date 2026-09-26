import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('operation report exposes canonical timing metrics and coverage state', async () => {
  const source = await readFile(new URL('./views/OperationReport.jsx', import.meta.url), 'utf8')
  for (const label of ['Tempo médio', 'Mediana', 'P90', 'Taxa no prazo', 'Pedidos no prazo', 'Cobertura parcial']) assert.match(source, new RegExp(label))
  assert.doesNotMatch(source, /preparation_started_at/)
})
