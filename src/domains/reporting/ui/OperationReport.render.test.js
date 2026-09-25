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
  for (const expected of ['Pedidos por hora operacional', '09h', 'Pedidos por dia da semana', 'Qui', 'Volume por modalidade', 'Entrega', 'Faixas de duração', 'Cobertura parcial', 'Indisponível']) assert.match(text, new RegExp(expected))
})
