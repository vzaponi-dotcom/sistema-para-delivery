import { REPORTING_EXPORT_FILTER_LABELS, formatReportingExportFilterValue } from './reportingExportPresentation.js'

const DATA_MONEY_KEYS = new Set([
  'subtotal_cents',
  'delivery_fee_cents',
  'adjustment_amount_cents',
  'total_cents',
  'paidCents',
  'pendingCents',
])

const asOrderDate = (value) => value ? new Date(`${value}T12:00:00.000Z`) : null

const asOrderDateTime = (value) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const preferredWidth = (label) => {
  if (/Cliente/i.test(label)) return 26
  if (/Telefone/i.test(label)) return 18
  if (/Forma de pagamento/i.test(label)) return 24
  if (/Data e hora/i.test(label)) return 19
  if (/Data|Prazo|Promessa/i.test(label)) return 15
  if (/Modalidade|Agendamento|Status|Situação/i.test(label)) return 18
  if (/Subtotal|Taxa|Ajuste|Total|Recebido|Pendente/i.test(label)) return 16
  return Math.max(12, Math.min(22, String(label || '').length + 3))
}

export async function createXlsxWorkbook(model) {
  const { default: { Workbook } } = await import('exceljs')
  const workbook = new Workbook()

  // Pedidos é a aba principal: uma linha por pedido do recorte completo.
  const data = workbook.addWorksheet('Pedidos')
  data.addRow(model.columns)
  for (const row of model.rows) {
    const cells = row.map((value, index) => {
      const key = model.columnKeys?.[index]
      if (DATA_MONEY_KEYS.has(key) && value != null) return Number(value) / 100
      if (key === 'order_date' || key === 'promised_payment_date') return asOrderDate(value) || 'Indisponível'
      if (key === 'created_at') return asOrderDateTime(value) || 'Indisponível'
      if (key === 'onTime') return value == null ? 'Indisponível' : value ? 'No prazo' : 'Atrasado'
      return value ?? 'Indisponível'
    })
    const added = data.addRow(cells)
    model.columnKeys?.forEach((key, index) => {
      const cell = added.getCell(index + 1)
      if (DATA_MONEY_KEYS.has(key) && cell.value !== 'Indisponível') cell.numFmt = '"R$" #,##0.00'
      if (key === 'order_date' || key === 'promised_payment_date') cell.numFmt = 'dd/mm/yyyy'
      if (key === 'created_at') cell.numFmt = 'dd/mm/yyyy hh:mm'
    })
  }
  data.getRow(1).font = { bold: true }
  data.views = [{ state: 'frozen', ySplit: 1 }]
  if (model.columns?.length) {
    data.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: model.columns.length } }
    model.columns.forEach((label, index) => { data.getColumn(index + 1).width = preferredWidth(label) })
  }

  // Resumo preserva contexto e KPIs, mas fica secundário ao extrato de pedidos.
  const summary = workbook.addWorksheet('Resumo')
  summary.addRow(['Relatório', model.title || 'Centro de Relatórios'])
  if (model.operation?.name) summary.addRow(['Operação', model.operation.name])
  if (model.period) summary.addRow(['Período', `${model.period.from} a ${model.period.to}`])
  summary.addRow(['Pedidos exportados', Number(model.rowCount || 0)])
  if (model.generatedAt) summary.addRow(['Gerado em', model.generatedAt])
  if (model.timezone) summary.addRow(['Fuso horário', model.timezone])

  const metricLabels = {
    salesCents: model.view === 'detail' ? 'Faturamento total' : 'Vendas registradas',
    ordersCount: model.view === 'detail' ? 'Pedidos no período' : 'Pedidos',
    averageTicketCents: 'Ticket médio',
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
  summary.getColumn(1).width = 27
  summary.getColumn(2).width = 34

  return workbook
}
