const cleanText = (value) => typeof value === 'string' ? value.trim() : ''

export const PAYMENT_ALLOCATIONS_JSON_SELECT = `p.receipt_id AS receipt_id,
  (SELECT COALESCE(json_group_array(json_object(
    'methodCode', allocation.method_code,
    'methodLabel', allocation.method_label,
    'amountCents', allocation.amount_cents
  )), '[]')
   FROM (
     SELECT pa.method_code, pa.method_label, pa.amount_cents
     FROM payment_allocations pa
     WHERE pa.business_id = o.business_id AND pa.receipt_id = p.receipt_id
     ORDER BY pa.created_at ASC, pa.id ASC
   ) allocation) AS payment_allocations_json`

export const parsePaymentAllocations = (row = {}) => {
  if (!row.payment_id) return []
  const structured = row.receipt_id != null || Object.hasOwn(row, 'payment_allocations_json')
  if (!structured) return []
  try {
    const parsed = JSON.parse(row.payment_allocations_json ?? '[]')
    if (!Array.isArray(parsed)) return []
    const allocations = parsed.map((allocation) => ({
      methodCode: allocation?.methodCode == null ? null : cleanText(allocation.methodCode),
      methodLabel: cleanText(allocation?.methodLabel),
      amountCents: Number(allocation?.amountCents),
    }))
    if (allocations.some((allocation) => (allocation.methodCode !== null && !allocation.methodCode)
      || !allocation.methodLabel
      || !Number.isSafeInteger(allocation.amountCents)
      || allocation.amountCents <= 0)) return []
    return allocations
  } catch {
    return []
  }
}

export const mapOrderPaymentFields = (row = {}) => {
  const paid = Boolean(row.payment_id)
  const structured = row.receipt_id != null || Object.hasOwn(row, 'payment_allocations_json')
  const paymentAllocations = parsePaymentAllocations(row)
  return {
    paymentStatus: paid ? 'Pago' : 'Pendente',
    paymentId: paid ? row.payment_id : null,
    paymentReceiptId: paid ? row.receipt_id ?? null : null,
    paymentMethod: paid
      ? (paymentAllocations.length === 1 ? paymentAllocations[0].methodLabel : structured ? null : row.payment_method ?? null)
      : null,
    paymentAllocations,
    paidAt: paid ? row.paid_at : null,
  }
}
