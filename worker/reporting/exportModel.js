import { apiError } from '../http.js'

export const EXPORT_LIMIT = 10_000
export const EXPORT_COLUMNS = Object.freeze({
  order_number: 'Pedido', order_date: 'Data', client_name_snapshot: 'Cliente',
  type: 'Modalidade', status: 'Status', total_cents: 'Total',
  paidCents: 'Recebido', pendingCents: 'Pendente', durationMinutes: 'Duração (min)', onTime: 'Prazo',
})
const DEFAULT_COLUMNS = Object.freeze(['order_number', 'order_date', 'client_name_snapshot', 'type', 'status', 'total_cents', 'paidCents', 'pendingCents'])

export function validateExportColumns(columns) {
  if (columns == null) return [...DEFAULT_COLUMNS]
  if (!Array.isArray(columns) || !columns.length || columns.length > Object.keys(EXPORT_COLUMNS).length
    || new Set(columns).size !== columns.length || columns.some((key) => !Object.hasOwn(EXPORT_COLUMNS, key))) {
    throw apiError(400, 'REPORTING_EXPORT_COLUMNS_INVALID', 'Colunas de exportação inválidas.')
  }
  return columns
}

export function createExportModel({ query, report, detail, columns, generatedAt = new Date().toISOString() }) {
  if (detail.total > EXPORT_LIMIT) throw apiError(422, 'REPORTING_EXPORT_LIMIT', 'Mais de 10.000 pedidos. Reduza o período ou os filtros para exportar.')
  const keys = validateExportColumns(columns)
  return {
    title: 'Centro de Relatórios', view: query.view, generatedAt, timezone: 'America/Sao_Paulo',
    period: { from: query.from, to: query.to, preset: query.period }, filters: query,
    columnKeys: keys, columns: keys.map((key) => EXPORT_COLUMNS[key]),
    rows: detail.items.map((item) => keys.map((key) => item[key] ?? null)), rowCount: detail.total,
    summary: report.data, comparison: report.comparison ?? null,
    quality: report.quality ?? {}, warnings: report.warnings ?? [],
  }
}
