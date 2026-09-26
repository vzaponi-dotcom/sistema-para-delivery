import test from 'node:test'
import assert from 'node:assert/strict'
import { workspaceHarness, nodeText } from '../../../test-support/renderWorkspace.js'

test('operation renders real hour, weekday, modality and duration distributions with coverage', async (t) => {
  const harness = await workspaceHarness(t)
  const { OperationReport } = await harness.load('/src/domains/reporting/ui/views/OperationReport.jsx')
  const renderer = await harness.render(OperationReport, { state: { loading: false, quality: { invalidCount: 1 }, data: {
    operationalOrdersCount: 2, averageDurationMinutes: 20, medianDurationMinutes: 20, p90DurationMinutes: 30,
    fastestMinutes: 10, slowestMinutes: 30, withinDeadlineCount: 1, outsideDeadlineCount: 1,
    withinDeadlineRate: 50, averageLateMinutes: 5, scheduledPunctualityRate: null,
    byHour: [{ hour: 9, count: 2 }], byWeekday: [{ weekday: 4, count: 2 }],
    byModality: [{ type: 'Entrega', count: 2, averageDurationMinutes: 20 }],
    bySchedule: [{ schedule: 'immediate', count: 1 }, { schedule: 'scheduled', count: 1 }],
    durationBands: [{ label: 'Até 15 min', count: 1 }, { label: '16–30 min', count: 1 }],
  } } })
  const text = nodeText(renderer.root)
  for (const expected of ['Performance operacional', 'Pedidos por hora operacional', 'Pedidos por dia da semana', 'Qui', 'Desempenho por modalidade', 'Entrega', 'Faixas de duração', 'Cobertura parcial', 'Indisponível', '20 min', 'Pedidos no prazo', 'Taxa no prazo']) assert.match(text, new RegExp(expected))
})


test('operation renders a compact 24-hour chart and keeps deadline drilldowns', async (t) => {
  const harness = await workspaceHarness(t)
  const { OperationReport } = await harness.load('/src/domains/reporting/ui/views/OperationReport.jsx')
  const drilled = []
  const renderer = await harness.render(OperationReport, { state: { loading: false, quality: {}, warnings: [], data: {
    operationalOrdersCount: 3, averageDurationMinutes: 22.5, medianDurationMinutes: 20, p90DurationMinutes: 40,
    fastestMinutes: 0, slowestMinutes: 40, withinDeadlineCount: 2, outsideDeadlineCount: 1,
    withinDeadlineRate: 66.67, averageLateMinutes: 10, scheduledPunctualityRate: 50,
    byHour: [{ hour: 9, count: 2 }, { hour: 21, count: 1 }],
    byWeekday: [{ weekday: 4, count: 3 }],
    byModality: [{ type: 'Entrega', count: 2, averageDurationMinutes: 25 }, { type: 'Local', count: 1, averageDurationMinutes: 15 }],
    bySchedule: [{ schedule: 'immediate', count: 2 }, { schedule: 'scheduled', count: 1 }],
    durationBands: [{ label: 'Até 15 min', count: 1 }, { label: '16–30 min', count: 2 }],
  } }, onDrilldown: (patch) => drilled.push(patch) })

  assert.ok(renderer.root.findByProps({ 'aria-label': 'Distribuição de pedidos por hora operacional' }))
  assert.match(nodeText(renderer.root), /0 min/)
  const onTime = renderer.root.findByProps({ 'aria-label': 'Ver detalhes: Pedidos no prazo' })
  onTime.props.onClick()
  assert.deepEqual(drilled.at(-1), { view: 'detail', operationalDeadline: 'on-time' })
})
