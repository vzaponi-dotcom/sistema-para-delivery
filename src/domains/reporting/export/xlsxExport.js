export async function createXlsxWorkbook(model) {
  const { default: { Workbook } } = await import('exceljs')
  const workbook = new Workbook()
  const summary = workbook.addWorksheet('Resumo')
  summary.addRow(['Relatório', 'Centro de Relatórios'])
  const data = workbook.addWorksheet('Dados')
  data.addRow(model.columns)
  for (const row of model.rows) data.addRow(row)
  return workbook
}
