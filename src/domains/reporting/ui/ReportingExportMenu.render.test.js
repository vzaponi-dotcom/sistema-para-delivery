import test from 'node:test'
import assert from 'node:assert/strict'
import { act } from 'react-test-renderer'
import { workspaceHarness, nodeText } from '../../../test-support/renderWorkspace.js'

test('export menu respects capability and downloads CSV from the official API model', async (t) => {
  const harness = await workspaceHarness(t)
  const { ReportingExportMenu } = await harness.load('/src/domains/reporting/ui/ReportingExportMenu.jsx')
  const query = { view: 'detail', from: '2026-09-01', to: '2026-09-10' }
  const denied = await harness.render(ReportingExportMenu, { query, granted: new Set() })
  assert.equal(nodeText(denied.root), '')
  const calls = []
  const model = { title: 'Centro de Relatórios', period: query, generatedAt: '2026-09-10T12:00:00Z', timezone: 'America/Sao_Paulo', filters: query, columnKeys: ['total_cents'], columns: ['Total'], rows: [[1234]] }
  const renderer = await harness.render(ReportingExportMenu, { query, columns: ['total_cents'], granted: new Set(['reports.export']), api: { exportModel: async (...args) => { calls.push(args); return { data: model } } }, onDownload: (download) => calls.push(download) })
  await act(async () => renderer.root.findAllByType('button').find((button) => nodeText(button) === 'CSV').props.onClick())
  assert.deepEqual(calls[0][1], ['total_cents'])
  assert.equal(calls[1].format, 'csv')
  assert.match(await calls[1].blob.text(), /R\$\s*12,34/)
})
