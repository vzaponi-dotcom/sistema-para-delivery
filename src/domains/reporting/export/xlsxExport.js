export async function createXlsxWorkbook(model) {
  const { default: { Workbook } } = await import('exceljs')
  const workbook = new Workbook()
  const summary = workbook.addWorksheet('Resumo')
  summary.addRow(['Relatório', model.title || 'Centro de Relatórios'])
  if (model.period) summary.addRow(['Período', `${model.period.from} a ${model.period.to}`])
  if (model.generatedAt) summary.addRow(['Gerado em', model.generatedAt])
  if (model.timezone) summary.addRow(['Timezone', model.timezone])
  for (const [key, value] of Object.entries(model.filters || {})) if (value != null && value !== '') summary.addRow([key, String(value)])
  for (const [key, value] of Object.entries(model.summary?.metrics || model.summary || {})) if (typeof value === 'number' || value === null) summary.addRow([key, value ?? 'Indisponível'])
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
