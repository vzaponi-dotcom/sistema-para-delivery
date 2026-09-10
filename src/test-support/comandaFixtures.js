export const comandaDetail = {
  id: 'tab-42', number: 42, status: 'open', openedAt: '2026-09-10T12:30:00Z',
  businessName: 'Restaurante', table: { id: 'occupied', name: 'Mesa 7' },
  orderCount: 2, itemCount: 3, totalCents: 12345,
  items: [
    { productId: 'p1', name: 'X-Bacon', presentation: 'Grande / queijo extra', note: 'Sem cebola', quantity: 2, unitPriceCents: 2500, lineTotalCents: 5000 },
    { productId: 'p1', name: 'X-Bacon', presentation: 'Pequeno', note: '', quantity: 1, unitPriceCents: 2000, lineTotalCents: 2000 },
  ],
}
export const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
export const detailResponse = (detail = comandaDetail) => ({ ok: true, json: async () => ({ tableTab: detail }) })
