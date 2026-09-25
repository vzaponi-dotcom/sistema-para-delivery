import { useState } from 'react'
import { reportingApi } from '../infrastructure/reportingApi.js'

const download = ({ blob, filename }) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function ReportingExportMenu({ query, columns, granted, api = reportingApi, onDownload = download }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  if (!(granted instanceof Set && granted.has('reports.export'))) return null
  const run = async (format) => {
    setBusy(true); setError(null)
    try {
      const response = await api.exportModel(query, columns)
      const model = response.data
      let blob
      if (format === 'csv') {
        const { exportReportingCsv } = await import('../export/csvExport.js')
        blob = new Blob([exportReportingCsv(model)], { type: 'text/csv;charset=utf-8' })
      } else if (format === 'xlsx') {
        const { createXlsxWorkbook } = await import('../export/xlsxExport.js')
        const workbook = await createXlsxWorkbook(model)
        blob = new Blob([await workbook.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      } else {
        const { createPdfSummary } = await import('../export/pdfExport.js')
        blob = (await createPdfSummary(model)).output('blob')
      }
      onDownload({ blob, filename: `relatorio-${query.view}-${query.from}-${query.to}.${format}`, format, model })
    } catch (cause) { setError(cause) } finally { setBusy(false) }
  }
  return <div className="reporting-export"><details><summary>Exportar relatório</summary><div className="reporting-export-options">
    {['csv', 'xlsx', 'pdf'].map((format) => <button key={format} type="button" disabled={busy} onClick={() => run(format)}>{format.toUpperCase()}</button>)}
  </div></details>{busy ? <span role="status">Preparando exportação…</span> : null}{error ? <p role="alert">{error.message || 'Não foi possível exportar.'}</p> : null}</div>
}
