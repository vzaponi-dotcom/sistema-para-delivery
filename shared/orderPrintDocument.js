export const ORDER_PRINT_DOCUMENT_VERSION = 1
export const ORDER_PRINT_THANK_YOU = 'Obrigado pela compra! Agradecemos a preferência.'

const nonNegativeInteger = (value) => Math.max(0, Math.round(Number(value) || 0))
const positiveQuantity = (value) => Math.max(1, Math.floor(Number(value) || 1))

export const getFriendlyOrderNumber = (id) => String(id ?? '').slice(-4)

export const formatPrintMoneyCents = (cents) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
}).format(nonNegativeInteger(cents) / 100)

export const createOrderPrintDocument = (input = {}) => ({
  version: ORDER_PRINT_DOCUMENT_VERSION,
  type: 'order',
  business: {
    name: String(input.businessName || 'Amor & Sabor'),
  },
  order: {
    id: String(input.orderId ?? ''),
    number: getFriendlyOrderNumber(input.orderId),
    orderDate: String(input.orderDate ?? ''),
    createdAt: String(input.createdAt ?? ''),
    type: String(input.type ?? ''),
  },
  customer: {
    name: String(input.customer?.name || ''),
    phone: String(input.customer?.phone || ''),
    address: String(input.customer?.address || ''),
  },
  items: (Array.isArray(input.items) ? input.items : []).map((item) => {
    const quantity = positiveQuantity(item?.quantity)
    const unitPriceCents = nonNegativeInteger(item?.unitPriceCents)
    return {
      name: String(item?.name || ''),
      presentation: String(item?.presentation || ''),
      quantity,
      note: String(item?.note || ''),
      unitPriceCents,
      lineTotalCents: unitPriceCents * quantity,
    }
  }),
  financial: {
    subtotalCents: nonNegativeInteger(input.subtotalCents),
    deliveryFeeCents: nonNegativeInteger(input.deliveryFeeCents),
    adjustment: {
      type: input.adjustment?.type || 'none',
      amountCents: nonNegativeInteger(input.adjustment?.amountCents),
      reason: String(input.adjustment?.reason || ''),
    },
    totalCents: nonNegativeInteger(input.totalCents),
  },
  payment: {
    status: input.payment?.status === 'Pago' ? 'Pago' : 'Pendente',
    method: String(input.payment?.method || ''),
  },
  message: ORDER_PRINT_THANK_YOU,
})

export const createTestPrintDocument = ({ businessName = 'Amor & Sabor', createdAt = new Date().toISOString() } = {}) => ({
  version: ORDER_PRINT_DOCUMENT_VERSION,
  type: 'test',
  business: {
    name: String(businessName || 'Amor & Sabor'),
  },
  test: {
    title: 'TESTE DE IMPRESSÃO',
    message: 'Impressora configurada com sucesso.',
    createdAt: String(createdAt),
  },
})
