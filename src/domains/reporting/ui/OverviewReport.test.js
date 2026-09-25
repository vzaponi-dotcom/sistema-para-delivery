import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('overview presents official KPIs and preserves receivables as navigation only', async () => {
  const source = await readFile(new URL('./views/OverviewReport.jsx', import.meta.url), 'utf8')
  const card = await readFile(new URL('./ReportingMetricCard.jsx', import.meta.url), 'utf8')
  const state = await readFile(new URL('./ReportingState.jsx', import.meta.url), 'utf8')
  assert.match(source, /Vendas registradas/)
  assert.match(source, /A receber do período/)
  assert.match(source, /Gerenciar em A receber/)
  assert.doesNotMatch(source, /Registrar pagamento/)
  assert.match(card, /Comparação indisponível/)
  assert.match(state, /Carregando métricas oficiais/)
})
