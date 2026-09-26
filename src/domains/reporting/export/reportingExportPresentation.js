export const REPORTING_EXPORT_FILTER_LABELS = Object.freeze({
  type: 'Modalidade',
  paymentMethod: 'Forma de pagamento',
  status: 'Status',
  schedule: 'Agendamento',
  category: 'Categoria',
  product: 'Produto',
  productName: 'Produto',
  customer: 'Cliente',
  search: 'Busca',
  operationalDeadline: 'Prazo operacional',
  orderHourFrom: 'Hora inicial',
  orderHourTo: 'Hora final',
  receivable: 'Recebível',
})

const PAYMENT_LABELS = Object.freeze({
  pix: 'Pix',
  cash: 'Dinheiro',
  credit_card: 'Cartão de crédito',
  debit_card: 'Cartão de débito',
  transfer: 'Transferência',
  other: 'Outros',
})

export function formatReportingExportFilterValue(key, value) {
  if (value === null || value === undefined || value === '') return ''
  if (key === 'receivable' && value === 'unpaid') return 'A receber'
  if (key === 'schedule') {
    if (value === 'immediate') return 'Imediato'
    if (value === 'scheduled') return 'Agendado'
  }
  if (key === 'operationalDeadline') {
    if (value === 'on-time') return 'No prazo'
    if (value === 'late') return 'Atrasado'
  }
  if (key === 'paymentMethod') return PAYMENT_LABELS[value] || String(value)
  return String(value)
}
