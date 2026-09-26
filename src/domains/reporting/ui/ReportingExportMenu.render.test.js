import test from 'node:test'
import assert from 'node:assert/strict'
import { act } from 'react-test-renderer'
import { workspaceHarness, nodeText } from '../../../test-support/renderWorkspace.js'

test('export menu distinguishes detailed data exports from the executive PDF and requests the full order dataset', async (t) => {
  const harness = await workspaceHarness(t)
  const { ReportingExportMenu } = await harness.load('/src/domains/reporting/ui/ReportingExportMenu.jsx')
  const query = { view: 'sales', from: '2026-09-01', to: '2026-09-10' }

  const denied = await harness.render(ReportingExportMenu, { query, granted: new Set() })
  assert.equal(nodeText(denied.root), '')

  const calls = []
  const model = {
    title: 'Centro de Relatórios',
    period: query,
    generatedAt: '2026-09-10T12:00:00Z',
    timezone: 'America/Sao_Paulo',
    filters: query,
    columnKeys: ['order_number', 'client_name_snapshot', 'total_cents'],
    columns: ['Pedido', 'Cliente', 'Total'],
    rows: [[42, 'Ana', 1234]],
    rowCount: 1,
  }

  const renderer = await harness.render(ReportingExportMenu, {
    query,
    granted: new Set(['reports.export']),
    api: { exportModel: async (...args) => { calls.push(args); return { data: model } } },
    onDownload: (download) => calls.push(download),
  })

  const text = nodeText(renderer.root)
  assert.match(text, /Excel — Pedidos do período/)
  assert.match(text, /CSV — Pedidos do período/)
  assert.match(text, /PDF — Resumo executivo/)
  assert.match(text, /uma linha por pedido/i)

  const csvButton = renderer.root.findAllByType('button').find((button) => nodeText(button).includes('CSV — Pedidos do período'))
  await act(async () => csvButton.props.onClick())

  assert.equal(calls[0][1], null)
  assert.equal(calls[1].format, 'csv')
  assert.equal(calls[1].filename, 'pedidos-2026-09-01-2026-09-10.csv')
  assert.match(await calls[1].blob.text(), /Ana/)
  assert.match(await calls[1].blob.text(), /R\$\s*12,34/)
})
