export function getReportingOrderReference(order = {}) {
  const rawNumber = order?.order_number
  const number = rawNumber === null || rawNumber === undefined ? '' : String(rawNumber).trim()
  if (number) {
    return {
      compact: `#${number}`,
      title: `Pedido #${number}`,
      aria: `pedido ${number}`,
      meta: null,
    }
  }

  const rawId = String(order?.id || '').trim()
  const shortId = rawId ? rawId.slice(0, 8) : ''
  return {
    compact: shortId ? `Sem nº · ${shortId}` : 'Sem nº',
    title: 'Pedido sem número',
    aria: shortId ? `pedido sem número ${shortId}` : 'pedido sem número',
    meta: shortId ? `ID ${shortId}` : null,
  }
}
