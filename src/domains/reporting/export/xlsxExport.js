import { REPORTING_EXPORT_FILTER_LABELS, formatReportingExportFilterValue } from './reportingExportPresentation.js'

export async function createXlsxWorkbook(model) {
  const { default: { Workbook } } = await import('exceljs')
  const workbook = new Workbook()
  const summary = workbook.addWorksheet('Resumo')
  summary.addRow(['Relatório', model.title || 'Centro de Relatórios'])
  if (model.operation?.name) summary.addRow(['Operação', model.operation.name])
  if (model.period) summary.addRow(['Período', `${model.period.from} a ${model.period.to}`])
  if (model.generatedAt) summary.addRow(['Gerado em', model.generatedAt])
  if (model.timezone) summary.addRow(['Fuso horário', model.timezone])
  const metricLabels = {
    salesCents: 'Vendas registradas', ordersCount: 'Pedidos', averageTicketCents: 'Ticket médio',
    receivedCents: 'Recebido no período', receivableCents: 'A receber',
    cancellationRate: 'Taxa de cancelamento', refundsCents: 'Estornos', withinDeadlineRate: 'Dentro do prazo',
    operationalOrdersCount: 'Pedidos operacionais', averageDurationMinutes: 'Tempo médio',
    medianDurationMinutes: 'Mediana', p90DurationMinutes: 'P90',
    merchandiseRevenueCents: 'Receita de mercadoria', deliveryFeesCents: 'Taxas de entrega',
    unitsSold: 'Unidades vendidas', mealsSold: 'Refeições vendidas',
    discountCents: 'Descontos', surchargeCents: 'Acréscimos',
  }
  const monetaryMetrics = new Set([
    'salesCents', 'averageTicketCents', 'receivedCents', 'receivableCents', 'refundsCents',
    'merchandiseRevenueCents', 'deliveryFeesCents', 'discountCents', 'surchargeCents',
  ])
  for (const [key, value] of Object.entries(model.filters || {})) {
    if (REPORTING_EXPORT_FILTER_LABELS[key] && value != null && value !== '') {
      summary.addRow([REPORTING_EXPORT_FILTER_LABELS[key], formatReportingExportFilterValue(key, value)])
    }
  }
  const summaryMetrics = model.summary?.metrics || model.summary?.summary || model.summary || {}
  for (const [key, value] of Object.entries(summaryMetrics)) {
    if (typeof value === 'number' || value === null) {
      const row = summary.addRow([metricLabels[key] || key, value == null ? 'Indisponível' : monetaryMetrics.has(key) ? value / 100 : value])
      if (monetaryMetrics.has(key) && value != null) row.getCell(2).numFmt = '"R$" #,##0.00'
    }
  }
  for (const warning of model.warnings || []) summary.addRow(['Aviso', warning])
  const data = workbook.addWorksheet('Dados')
  data.addRow(model.columns)
  for (const row of model.rows) {
    const cells = row.map((value, index) => {
      const key = model.columnKeys?.[index]
      if (['total_cents', 'paidCents', 'pendingCents'].includes(key) && value != null) return value / 100
      if (key === 'order_date' && value) return new Date(`${value}T12:00:00.000Z`)
      if (key === 'onTime') return value == null ? 'Indisponível' : value ? 'No prazo' : 'Atrasado'
      return value ?? 'Indisponível'
    })
    const added = data.addRow(cells)
    model.columnKeys?.forEach((key, index) => {
      if (['total_cents', 'paidCents', 'pendingCents'].includes(key)) added.getCell(index + 1).numFmt = '"R$" #,##0.00'
      if (key === 'order_date') added.getCell(index + 1).numFmt = 'dd/mm/yyyy'
    })
  }
  data.getRow(1).font = { bold: true }
  data.views = [{ state: 'frozen', ySplit: 1 }]
  return workbook
}
