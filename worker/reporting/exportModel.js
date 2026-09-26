import { apiError } from '../http.js'

export const EXPORT_LIMIT = 10_000
export const EXPORT_COLUMNS = Object.freeze({
  order_number: 'Pedido',
  order_date: 'Data',
  created_at: 'Data e hora',
  client_name_snapshot: 'Cliente',
  client_phone_snapshot: 'Telefone',
  type: 'Modalidade',
  scheduleLabel: 'Agendamento',
  status: 'Status',
  subtotal_cents: 'Subtotal',
  delivery_fee_cents: 'Taxa de entrega',
  adjustment_type: 'Tipo de ajuste',
  adjustment_amount_cents: 'Valor do ajuste',
  total_cents: 'Total',
  paidCents: 'Recebido',
  pendingCents: 'Pendente',
  paymentState: 'Situação financeira',
  payment_label: 'Forma de pagamento',
  promised_payment_date: 'Promessa de pagamento',
  durationMinutes: 'Duração (min)',
  onTime: 'Prazo',
})
export const REPORTING_DATA_EXPORT_COLUMNS = Object.freeze(Object.keys(EXPORT_COLUMNS))
const DEFAULT_COLUMNS = REPORTING_DATA_EXPORT_COLUMNS

export function validateExportColumns(columns) {
  if (columns == null) return [...DEFAULT_COLUMNS]
  if (!Array.isArray(columns) || !columns.length || columns.length > Object.keys(EXPORT_COLUMNS).length
    || new Set(columns).size !== columns.length || columns.some((key) => !Object.hasOwn(EXPORT_COLUMNS, key))) {
    throw apiError(400, 'REPORTING_EXPORT_COLUMNS_INVALID', 'Colunas de exportação inválidas.')
  }
  return columns
}

const exportCellValue = (item, key) => {
  if (key === 'order_number' && (item?.order_number === null || item?.order_number === undefined || String(item.order_number).trim() === '')) {
    const shortId = String(item?.id || '').trim().slice(0, 8)
    return shortId ? `Sem nº · ${shortId}` : 'Sem nº'
  }
  if (key === 'scheduleLabel') return item?.scheduled_for ? 'Agendado' : 'Imediato'
  if (key === 'adjustment_type') {
    if (!item?.adjustment_type || item.adjustment_type === 'none' || Number(item?.adjustment_amount_cents || 0) === 0) return null
    return item.adjustment_type === 'discount' ? 'Desconto' : 'Acréscimo'
  }
  if (key === 'paymentState') {
    if (item?.status === 'Cancelado') return null
    const paid = Number(item?.paidCents || 0)
    const pending = Number(item?.pendingCents || 0)
    if (paid > 0 && pending === 0) return 'Pago'
    if (pending > 0) return 'Não pago'
    return null
  }
  return item?.[key] ?? null
}

export function createExportModel({ query, report, detail, columns, operation = null, generatedAt = new Date().toISOString() }) {
  if (detail.total > EXPORT_LIMIT) throw apiError(422, 'REPORTING_EXPORT_LIMIT', 'Mais de 10.000 pedidos. Reduza o período ou os filtros para exportar.')
  const keys = validateExportColumns(columns)
  return {
    title: 'Centro de Relatórios', view: query.view, generatedAt, timezone: 'America/Sao_Paulo', operation,
    period: { from: query.from, to: query.to, preset: query.period }, filters: query,
    columnKeys: keys, columns: keys.map((key) => EXPORT_COLUMNS[key]),
    rows: detail.items.map((item) => keys.map((key) => exportCellValue(item, key))), rowCount: detail.total,
    summary: report.data, comparison: report.comparison ?? null,
    quality: report.quality ?? {}, warnings: report.warnings ?? [],
  }
}
