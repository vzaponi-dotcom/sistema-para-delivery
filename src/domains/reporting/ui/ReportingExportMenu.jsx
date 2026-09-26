import { useRef, useState } from 'react'
import { reportingApi } from '../infrastructure/reportingApi.js'

const EXPORT_OPTIONS = Object.freeze([
  {
    format: 'xlsx',
    title: 'Excel — Pedidos do período',
    description: 'Base completa, uma linha por pedido, pronta para análise.',
  },
  {
    format: 'csv',
    title: 'CSV — Pedidos do período',
    description: 'Dados tabulares completos para importar ou analisar.',
  },
  {
    format: 'pdf',
    title: 'PDF — Resumo executivo',
    description: 'Indicadores, comparação e contexto do período selecionado.',
  },
])

const download = ({ blob, filename }) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

const filenameFor = (format, query) => format === 'pdf'
  ? `resumo-relatorio-${query.view}-${query.from}-${query.to}.pdf`
  : `pedidos-${query.from}-${query.to}.${format}`

export function ReportingExportMenu({ query, granted, api = reportingApi, onDownload = download }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const detailsRef = useRef(null)

  if (!(granted instanceof Set && granted.has('reports.export'))) return null

  const run = async (format) => {
    setBusy(true)
    setError(null)
    try {
      // Excel e CSV sempre recebem a base detalhada completa do recorte.
      // A seleção visual de colunas da tabela não limita a exportação.
      const response = await api.exportModel(query, null)
      const model = response.data
      let blob

      if (format === 'csv') {
        const { exportReportingCsv } = await import('../export/csvExport.js')
        blob = new Blob([exportReportingCsv(model)], { type: 'text/csv;charset=utf-8' })
      } else if (format === 'xlsx') {
        const { createXlsxWorkbook } = await import('../export/xlsxExport.js')
        const workbook = await createXlsxWorkbook(model)
        blob = new Blob(
          [await workbook.xlsx.writeBuffer()],
          { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        )
      } else {
        const { createPdfSummary } = await import('../export/pdfExport.js')
        blob = (await createPdfSummary(model)).output('blob')
      }

      onDownload({ blob, filename: filenameFor(format, query), format, model })
      if (detailsRef.current) detailsRef.current.open = false
    } catch (cause) {
      setError(cause)
    } finally {
      setBusy(false)
    }
  }

  return <div className="reporting-export">
    <details ref={detailsRef}>
      <summary>Exportar</summary>
      <div className="reporting-export-options">
        <div className="reporting-export-options-heading">
          <strong>Exportar dados</strong>
          <small>O período e os filtros ativos serão respeitados.</small>
        </div>
        {EXPORT_OPTIONS.map((option) => <button
          key={option.format}
          type="button"
          disabled={busy}
          onClick={() => run(option.format)}
        >
          <strong>{option.title}</strong>
          <small>{option.description}</small>
        </button>)}
      </div>
    </details>
    {busy ? <span role="status">Preparando exportação…</span> : null}
    {error ? <p role="alert">{error.message || 'Não foi possível exportar.'}</p> : null}
  </div>
}
