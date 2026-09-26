import test from 'node:test'
import assert from 'node:assert/strict'
import { formatReportingExportFilterValue } from './reportingExportPresentation.js'

test('reporting export presentation maps technical filter enums to UI language', () => {
  assert.equal(formatReportingExportFilterValue('receivable', 'unpaid'), 'A receber')
  assert.equal(formatReportingExportFilterValue('schedule', 'scheduled'), 'Agendado')
  assert.equal(formatReportingExportFilterValue('schedule', 'immediate'), 'Imediato')
  assert.equal(formatReportingExportFilterValue('operationalDeadline', 'on-time'), 'No prazo')
  assert.equal(formatReportingExportFilterValue('operationalDeadline', 'late'), 'Atrasado')
  assert.equal(formatReportingExportFilterValue('paymentMethod', 'pix'), 'Pix')
  assert.equal(formatReportingExportFilterValue('paymentMethod', 'cash'), 'Dinheiro')
  assert.equal(formatReportingExportFilterValue('search', 'Fernanda'), 'Fernanda')
})
