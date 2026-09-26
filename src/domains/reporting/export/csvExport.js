import { REPORTING_EXPORT_FILTER_LABELS, formatReportingExportFilterValue } from './reportingExportPresentation.js'

const escape = (value) => {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function exportCsv({ columns = [], rows = [] }) {
  return `\uFEFF${[columns, ...rows].map((row) => row.map(escape).join(',')).join('\r\n')}`
}

const moneyKeys = new Set([
  'subtotal_cents',
  'delivery_fee_cents',
  'adjustment_amount_cents',
  'total_cents',
  'paidCents',
  'pendingCents',
])
export function exportReportingCsv(model) {
  const format = (value, key) => {
    if (value == null) return 'Indisponível'
    if (moneyKeys.has(key)) return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100)
    if (key === 'order_date' || key === 'promised_payment_date') return String(value).split('-').reverse().join('/')
    if (key === 'created_at') {
      const parsed = new Date(value)
      if (Number.isNaN(parsed.getTime())) return String(value)
      return new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }).format(parsed)
    }
    if (key === 'onTime') return value ? 'No prazo' : 'Atrasado'
    return value
  }
  const rows = model.rows.map((row) => row.map((value, index) => format(value, model.columnKeys[index])))
  const metadata = [
    ['Relatório', model.title],
    ...(model.operation?.name ? [['Operação', model.operation.name]] : []),
    ['Período', `${model.period.from} a ${model.period.to}`],
    ['Gerado em', model.generatedAt], ['Timezone', model.timezone],
    ...Object.entries(model.filters || {})
      .filter(([key, value]) => !['view', 'from', 'to', 'period', 'page', 'pageSize'].includes(key) && value != null && value !== '')
      .map(([key, value]) => [REPORTING_EXPORT_FILTER_LABELS[key] || key, formatReportingExportFilterValue(key, value)]),
    [],
  ]
  return exportCsv({ columns: model.columns, rows: [...rows] }).replace(/^\uFEFF/, `\uFEFF${metadata.map((row) => row.map(escape).join(',')).join('\r\n')}\r\n`)
}
