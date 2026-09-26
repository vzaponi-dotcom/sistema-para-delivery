import test from 'node:test'
import assert from 'node:assert/strict'
import { workspaceHarness, nodeText } from '../../../test-support/renderWorkspace.js'

test('reporting state distinguishes initial loading, empty, error and stale data with refresh failure', async (t) => {
  const harness = await workspaceHarness(t)
  const { ReportingState } = await harness.load('/src/domains/reporting/ui/ReportingState.jsx')
  const loading = await harness.render(ReportingState, { state: { loading: true, data: null }, children: 'RESULT' })
  assert.match(nodeText(loading.root), /Carregando/)
  const error = await harness.render(ReportingState, { state: { error: new Error('offline'), data: null }, children: 'RESULT' })
  assert.match(nodeText(error.root), /Não foi possível/)
  const empty = await harness.render(ReportingState, { state: { data: null }, children: 'RESULT' })
  assert.match(nodeText(empty.root), /Nenhum dado/)
  const partial = await harness.render(ReportingState, { state: { data: {}, error: new Error('offline'), loading: false }, children: 'RESULT' })
  assert.match(nodeText(partial.root), /RESULT/)
  assert.match(nodeText(partial.root), /últimos dados válidos/)
})
