export const TABLE_TAB_PRINT_DOCUMENT_VERSION = 1

export const createTableTabPrintDocument = (detail, emittedAt = new Date().toISOString()) => ({
  version: TABLE_TAB_PRINT_DOCUMENT_VERSION,
  type: 'table-tab',
  business: { name: String(detail.businessName || 'Amor & Sabor') },
  tableTab: {
    id: String(detail.id),
    number: Number(detail.number),
    tableName: String(detail.table?.name || ''),
    openedAt: String(detail.openedAt || ''),
    emittedAt: String(emittedAt),
  },
  items: detail.items.map((item) => ({ ...item })),
  financial: { totalCents: Number(detail.totalCents) || 0 },
  payment: { status: 'Pendente', method: '' },
  message: 'PRÉ-CONTA — NÃO É COMPROVANTE DE PAGAMENTO',
})
