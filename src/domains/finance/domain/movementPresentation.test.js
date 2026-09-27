import test from 'node:test'
import assert from 'node:assert/strict'
import { groupFinanceMovementsForDisplay } from './movementPresentation.js'

test('groups allocation-backed order-payment movements from the same receipt into one visible receipt', () => {
  const movements = [
    {
      id: 'm-cash',
      source: 'order-payment',
      receiptId: 'receipt-1',
      paymentAllocationId: 'a-cash',
      description: 'Pagamento pedido #12 · Ana',
      type: 'entrada',
      category: 'Vendas',
      categoryLabel: 'Vendas',
      date: '2026-09-21',
      paymentMethod: 'Dinheiro',
      value: 30,
    },
    {
      id: 'm-pix',
      source: 'order-payment',
      receiptId: 'receipt-1',
      paymentAllocationId: 'a-pix',
      description: 'Pagamento pedido #12 · Ana',
      type: 'entrada',
      category: 'Vendas',
      categoryLabel: 'Vendas',
      date: '2026-09-21',
      paymentMethod: 'Pix',
      value: 50,
    },
    {
      id: 'manual-1',
      source: 'manual',
      receiptId: null,
      description: 'Troco',
      type: 'saida',
      category: 'Outros',
      categoryLabel: 'Outros',
      date: '2026-09-21',
      paymentMethod: 'Dinheiro',
      value: 5,
    },
  ]

  assert.deepEqual(groupFinanceMovementsForDisplay(movements), [
    {
      id: 'receipt:receipt-1',
      source: 'order-payment',
      receiptId: 'receipt-1',
      description: 'Pagamento pedido #12 · Ana',
      type: 'entrada',
      category: 'Vendas',
      categoryLabel: 'Vendas',
      date: '2026-09-21',
      value: 80,
      paymentMethod: null,
      paymentBreakdown: [
        { movementId: 'm-cash', methodLabel: 'Dinheiro', value: 30 },
        { movementId: 'm-pix', methodLabel: 'Pix', value: 50 },
      ],
    },
    movements[2],
  ])
})

test('keeps simple and legacy movements visually unchanged', () => {
  const simple = {
    id: 'm-pix',
    source: 'order-payment',
    receiptId: 'receipt-simple',
    description: 'Pagamento pedido #13 · Bia',
    type: 'entrada',
    category: 'Vendas',
    categoryLabel: 'Vendas',
    date: '2026-09-21',
    paymentMethod: 'Pix',
    value: 40,
  }
  const legacy = {
    id: 'legacy',
    source: 'order-payment',
    receiptId: null,
    description: 'Pagamento legado',
    type: 'entrada',
    category: 'Vendas',
    categoryLabel: 'Vendas',
    date: '2026-09-20',
    paymentMethod: 'Dinheiro',
    value: 20,
  }

  assert.deepEqual(groupFinanceMovementsForDisplay([simple, legacy]), [simple, legacy])
})


test('shared client receipt is presented once with its full allocation breakdown', () => {
  const movements = [
    {
      id: 'client-cash',
      source: 'order-payment',
      receiptId: 'client-receipt',
      paymentAllocationId: 'client-allocation-cash',
      description: 'Recebimento cliente · Fernanda Albuquerque · 2 pedidos',
      type: 'entrada',
      category: 'Vendas',
      categoryLabel: 'Vendas',
      date: '2026-09-27',
      paymentMethod: 'Dinheiro',
      value: 30,
      orderId: null,
      paymentId: null,
    },
    {
      id: 'client-pix',
      source: 'order-payment',
      receiptId: 'client-receipt',
      paymentAllocationId: 'client-allocation-pix',
      description: 'Recebimento cliente · Fernanda Albuquerque · 2 pedidos',
      type: 'entrada',
      category: 'Vendas',
      categoryLabel: 'Vendas',
      date: '2026-09-27',
      paymentMethod: 'Pix',
      value: 39,
      orderId: null,
      paymentId: null,
    },
  ]

  const rows = groupFinanceMovementsForDisplay(movements)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].id, 'receipt:client-receipt')
  assert.equal(rows[0].value, 69)
  assert.equal(rows[0].paymentMethod, null)
  assert.deepEqual(rows[0].paymentBreakdown, [
    { movementId: 'client-cash', methodLabel: 'Dinheiro', value: 30 },
    { movementId: 'client-pix', methodLabel: 'Pix', value: 39 },
  ])
})
