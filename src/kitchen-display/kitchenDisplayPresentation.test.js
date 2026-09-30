import test from 'node:test'
import assert from 'node:assert/strict'

import {
  KITCHEN_TV_NEAR_LIMIT_MINUTES,
  buildKitchenDisplayPages,
  buildKitchenDisplayPresentation,
} from './kitchenDisplayPresentation.js'

const now = new Date('2026-09-22T15:00:00.000Z')
const timing = { scheduledPrepLeadMinutes: 50, scheduledLateGraceMinutes: 15, immediateLateAfterMinutes: 30, immediateVeryLateAfterMinutes: 60 }
const denseItems = (prefix = 'Produto') => Array.from({ length: 8 }, (_, index) => ({ quantity: 1, name: `${prefix} Família Especial Completo ${index + 1}`, note: '' }))
const preparing = (index, createdAt = '2026-09-22T14:50:00.000Z', items = []) => ({ id: `p-${String(index).padStart(2, '0')}`, orderNumber: index, status: 'Em preparo', type: 'Entrega', client: `Cliente ${index}`, createdAt, items })
const scheduled = (index, items = []) => ({ id: `s-${String(index).padStart(2, '0')}`, orderNumber: 100 + index, status: 'Em preparo', type: 'Retirada', client: `Agendado ${index}`, createdAt: '2026-09-22T12:00:00.000Z', scheduledFor: new Date(now.getTime() + (120 + index) * 60_000).toISOString(), items })

test('six-slot allocation covers 0-8 preparing with no scheduled orders', () => {
  for (let count = 0; count <= 8; count += 1) {
    const result = buildKitchenDisplayPresentation(Array.from({ length: count }, (_, index) => preparing(index)), timing, now)
    assert.equal(result.cards.length, Math.min(6, count), `preparing=${count}`)
    assert.equal(result.overflow, Math.max(0, count - 6), `preparing=${count}`)
    assert.equal(result.cards.every(({ phase }) => phase === 'preparing'), true)
    assert.equal(result.cards.every(({ slotCost }) => slotCost === 3), true)
  }
})

test('scheduled work only uses space left after every visible preparing order', () => {
  for (let preparingCount = 0; preparingCount <= 8; preparingCount += 1) {
    for (const scheduledCount of [1, 4, 8]) {
      const orders = [
        ...Array.from({ length: preparingCount }, (_, index) => preparing(index)),
        ...Array.from({ length: scheduledCount }, (_, index) => scheduled(index)),
      ]
      const result = buildKitchenDisplayPresentation(orders, timing, now)
      const expectedPreparing = Math.min(6, preparingCount)
      const expectedScheduled = preparingCount < 6
        ? Math.min(scheduledCount, 6 - preparingCount)
        : 0
      assert.equal(result.cards.filter(({ phase }) => phase === 'preparing').length, expectedPreparing)
      assert.equal(result.cards.filter(({ phase }) => phase === 'scheduled').length, expectedScheduled)
      assert.equal(result.cards.length, expectedPreparing + expectedScheduled)
      assert.equal(result.overflow, preparingCount + scheduledCount - result.cards.length)
      assert.equal(result.cards.at(-1)?.phase, expectedScheduled ? 'scheduled' : 'preparing')
    }
  }
})

test('a tall preparing card keeps priority over a waiting scheduled card', () => {
  const orders = [
    preparing(1, undefined, denseItems('Grande')),
    preparing(2),
    preparing(3),
    preparing(4),
    preparing(5),
    scheduled(1),
  ]
  const result = buildKitchenDisplayPresentation(orders, timing, now)

  assert.deepEqual(result.cards.map(({ order }) => order.id), ['p-01', 'p-02', 'p-03', 'p-04', 'p-05'])
  assert.deepEqual(result.cards.map(({ slotCost }) => slotCost), [6, 3, 3, 3, 3])
  assert.equal(result.cards.find(({ order }) => order.id === 'p-01')?.layoutDemand, 'tall')
  assert.equal(result.cards.some(({ order }) => order.id === 's-01'), false)
  assert.equal(result.overflow, 1)
})

test('a large waiting scheduled card never displaces a preparing order', () => {
  const orders = [
    preparing(1),
    preparing(2),
    preparing(3),
    preparing(4),
    preparing(5),
    scheduled(1, denseItems('Agendado grande')),
  ]
  const result = buildKitchenDisplayPresentation(orders, timing, now)

  assert.deepEqual(result.cards.map(({ order }) => order.id), ['p-01', 'p-02', 'p-03', 'p-04', 'p-05'])
  assert.equal(result.cards.some(({ order }) => order.id === 's-01'), false)
  assert.equal(result.overflow, 1)
})

test('scheduled cards fill only genuine free capacity after the preparing queue', () => {
  const fillable = buildKitchenDisplayPresentation([
    preparing(1, undefined, denseItems('Grande')),
    scheduled(1),
    scheduled(2),
    scheduled(3),
    scheduled(4),
  ], timing, now)

  assert.deepEqual(fillable.cards.map(({ order }) => order.id), ['p-01', 's-01', 's-02', 's-03', 's-04'])
  assert.equal(fillable.cards.reduce((sum, card) => sum + card.slotCost, 0), 18)
  assert.equal(fillable.overflow, 0)

  const blocked = buildKitchenDisplayPresentation([
    preparing(1),
    preparing(2),
    preparing(3),
    preparing(4),
    preparing(5, undefined, denseItems('Prioritário grande')),
    scheduled(1),
    scheduled(2),
  ], timing, now)

  assert.deepEqual(blocked.cards.map(({ order }) => order.id), ['p-01', 'p-02', 'p-03', 'p-04', 'p-05'])
  assert.equal(blocked.cards.some(({ phase }) => phase === 'scheduled'), false)
  assert.equal(blocked.overflow, 2)
})

test('state precedence is new, late, near-limit, preparing, scheduled', () => {
  assert.equal(KITCHEN_TV_NEAR_LIMIT_MINUTES, 5)
  const orders = [
    preparing(1, '2026-09-22T14:29:00.000Z'),
    preparing(2, '2026-09-22T14:35:00.000Z'),
    preparing(3, '2026-09-22T14:40:00.000Z'),
    scheduled(1),
  ]
  const result = buildKitchenDisplayPresentation(orders, timing, now, new Set(['p-01', 'p-03', 's-01']))
  const states = Object.fromEntries(result.cards.map((entry) => [entry.order.id, entry.state]))
  assert.equal(states['p-01'], 'new')
  assert.equal(states['p-02'], 'near-limit')
  assert.equal(states['p-03'], 'new')
  assert.equal(states['s-01'], 'new')

  const unhighlighted = buildKitchenDisplayPresentation(orders, timing, now)
  const plainStates = Object.fromEntries(unhighlighted.cards.map((entry) => [entry.order.id, entry.state]))
  assert.equal(plainStates['p-01'], 'late')
  assert.equal(plainStates['p-02'], 'near-limit')
  assert.equal(plainStates['p-03'], 'preparing')
  assert.equal(plainStates['s-01'], 'scheduled')
})

test('header counters describe the complete queue rather than only visible cards', () => {
  const orders = [...Array.from({ length: 8 }, (_, index) => preparing(index)), scheduled(1), scheduled(2)]
  const result = buildKitchenDisplayPresentation(orders, timing, now)
  assert.deepEqual(result.counts, { preparing: 8, late: 0, scheduled: 2 })
  assert.equal(result.cards.length, 6)
  assert.equal(result.overflow, 4)
})


test('large viewport expands short-order capacity to twelve while small queues remain focus-sized', () => {
  const ten = buildKitchenDisplayPresentation(
    Array.from({ length: 10 }, (_, index) => preparing(index)),
    timing,
    now,
    new Set(),
    { viewportWidth: 1640, viewportHeight: 924 },
  )
  assert.equal(ten.profile.id, 'compact')
  assert.equal(ten.cards.length, 10)
  assert.equal(ten.overflow, 0)

  const twelve = buildKitchenDisplayPresentation(
    Array.from({ length: 12 }, (_, index) => preparing(index)),
    timing,
    now,
    new Set(),
    { viewportWidth: 1920, viewportHeight: 1080 },
  )
  assert.equal(twelve.profile.id, 'compact')
  assert.equal(twelve.cards.length, 12)
  assert.equal(twelve.overflow, 0)

  const four = buildKitchenDisplayPresentation(
    Array.from({ length: 4 }, (_, index) => preparing(index)),
    timing,
    now,
    new Set(),
    { viewportWidth: 1920, viewportHeight: 1080 },
  )
  assert.equal(four.profile.id, 'focus')
  assert.equal(four.cards.length, 4)
})

test('1366x768 uses compact density when it is the first profile that fits the full queue', () => {
  const result = buildKitchenDisplayPresentation(
    Array.from({ length: 10 }, (_, index) => preparing(index)),
    timing,
    now,
    new Set(),
    { viewportWidth: 1366, viewportHeight: 768 },
  )
  assert.equal(result.profile.id, 'compact')
  assert.equal(result.cards.length, 10)
  assert.equal(result.overflow, 0)
})

test('compact profile shows a waiting scheduled order only when all preparing work already fits', () => {
  const orders = [
    ...Array.from({ length: 11 }, (_, index) => preparing(index)),
    scheduled(1),
  ]
  const result = buildKitchenDisplayPresentation(
    orders,
    timing,
    now,
    new Set(),
    { viewportWidth: 1920, viewportHeight: 1080 },
  )

  assert.equal(result.profile.id, 'compact')
  assert.equal(result.cards.length, 12)
  assert.equal(result.cards.filter(({ phase }) => phase === 'preparing').length, 11)
  assert.equal(result.cards.filter(({ phase }) => phase === 'scheduled').length, 1)
  assert.equal(result.cards.at(-1).order.id, 's-01')
  assert.equal(result.overflow, 0)
})

test('compact profile gives complex work extra tracks before pushing lower-priority cards to overflow', () => {
  const orders = [
    preparing(1, undefined, denseItems('Pedido grande')),
    ...Array.from({ length: 39 }, (_, index) => preparing(index + 2)),
  ]
  const result = buildKitchenDisplayPresentation(
    orders,
    timing,
    now,
    new Set(),
    { viewportWidth: 1920, viewportHeight: 1080 },
  )

  assert.equal(result.profile.id, 'compact')
  assert.equal(result.cards[0].gridSpan >= 6, true)
  assert.equal(result.cards.length < 40, true)
  assert.equal(result.overflow, orders.length - result.cards.length)
  assert.equal(result.cards[0].order.id, 'p-01')
})


test('compact presentation can expose sixteen one-item orders on a large viewport', () => {
  const orders = Array.from({ length: 16 }, (_, index) => preparing(index, undefined, [
    { quantity: 1, name: 'Marmita', note: '' },
  ]))
  const result = buildKitchenDisplayPresentation(
    orders,
    timing,
    now,
    new Set(),
    { viewportWidth: 1920, viewportHeight: 1080 },
  )

  assert.equal(result.profile.id, 'compact')
  assert.equal(result.cards.length, 16)
  assert.equal(result.overflow, 0)
  assert.equal(result.cards.every((card) => card.gridSpan === 4), true)
})


test('best-fit keeps seven short orders in three columns instead of jumping directly to four', () => {
  const result = buildKitchenDisplayPresentation(
    Array.from({ length: 7 }, (_, index) => preparing(index + 1, undefined, [
      { quantity: 1, name: 'Marmita', note: '' },
    ])),
    timing,
    now,
    new Set(),
    { viewportWidth: 1920, viewportHeight: 1080 },
  )

  assert.equal(result.profile.id, 'roomy')
  assert.equal(result.profile.columns, 3)
  assert.equal(result.cards.length, 7)
  assert.equal(result.overflow, 0)
})

test('best-fit keeps nine short orders in three columns when roomy still fits all of them', () => {
  const result = buildKitchenDisplayPresentation(
    Array.from({ length: 9 }, (_, index) => preparing(index + 1, undefined, [
      { quantity: 1, name: 'Marmita', note: '' },
    ])),
    timing,
    now,
    new Set(),
    { viewportWidth: 1920, viewportHeight: 1080 },
  )

  assert.equal(result.profile.id, 'roomy')
  assert.equal(result.profile.columns, 3)
  assert.equal(result.cards.length, 9)
  assert.equal(result.overflow, 0)
})

test('best-fit uses four columns only when the three-column candidate cannot fit the actual content', () => {
  const mediumItems = [
    { quantity: 1, name: 'Arroz', note: '' },
    { quantity: 1, name: 'Feijão', note: '' },
    { quantity: 1, name: 'Batata', note: '' },
    { quantity: 1, name: 'Carne', note: '' },
  ]
  const result = buildKitchenDisplayPresentation(
    Array.from({ length: 8 }, (_, index) => preparing(index + 1, undefined, mediumItems)),
    timing,
    now,
    new Set(),
    { viewportWidth: 1920, viewportHeight: 1080 },
  )

  assert.equal(result.profile.id, 'balanced')
  assert.equal(result.profile.columns, 4)
  assert.equal(result.cards.length, 8)
  assert.equal(result.overflow, 0)
})

test('best-fit chooses the smallest overflow when no available profile can fit the full queue', () => {
  const result = buildKitchenDisplayPresentation(
    Array.from({ length: 30 }, (_, index) => preparing(index + 1, undefined, [
      { quantity: 1, name: 'Marmita', note: '' },
    ])),
    timing,
    now,
    new Set(),
    { viewportWidth: 960, viewportHeight: 540 },
  )

  assert.equal(result.profile.id, 'compact')
  assert.equal(result.profile.columns, 4)
  assert.equal(result.cards.length, 16)
  assert.equal(result.overflow, 14)
})


test('legacy TV viewport does not get trapped in six-card focus mode', () => {
  const result = buildKitchenDisplayPresentation(
    Array.from({ length: 16 }, (_, index) => preparing(index + 1, undefined, [
      { quantity: 1, name: 'Marmita', note: '' },
    ])),
    timing,
    now,
    new Set(),
    { viewportWidth: 960, viewportHeight: 540 },
  )

  assert.equal(result.profile.id, 'compact')
  assert.equal(result.profile.columns, 4)
  assert.equal(result.cards.length, 16)
  assert.equal(result.overflow, 0)
})

test('legacy TV best-fit still chooses the profile that shows most mixed-size orders', () => {
  const fourItems = [
    { quantity: 1, name: 'Arroz', note: '' },
    { quantity: 1, name: 'Feijão', note: '' },
    { quantity: 1, name: 'Batata', note: '' },
    { quantity: 1, name: 'Carne', note: '' },
  ]
  const orders = [
    preparing(1, undefined, fourItems),
    preparing(2, undefined, fourItems),
    ...Array.from({ length: 14 }, (_, index) => preparing(index + 3, undefined, [
      { quantity: 1, name: 'Marmita', note: '' },
    ])),
  ]

  const result = buildKitchenDisplayPresentation(
    orders,
    timing,
    now,
    new Set(),
    { viewportWidth: 960, viewportHeight: 540 },
  )

  assert.equal(result.profile.id, 'compact')
  assert.equal(result.cards.length > 6, true)
  assert.equal(result.overflow < 10, true)
})


test('adaptive fill gives one order the full board width and height', () => {
  const result = buildKitchenDisplayPresentation(
    [preparing(1, undefined, [{ quantity: 1, name: 'Marmita', note: '' }])],
    timing,
    now,
    new Set(),
    { viewportWidth: 1920, viewportHeight: 1080 },
  )

  assert.equal(result.profile.columns, 1)
  assert.equal(result.cards.length, 1)
  assert.equal(result.overflow, 0)
  assert.equal(result.cards[0].gridPosition.gridColumn, 1)
  assert.equal(result.cards[0].gridPosition.rowSpan, result.profile.gridRows)
  assert.equal(result.cards[0].gridPosition.gridRow, `1 / span ${result.profile.gridRows}`)
})

test('adaptive fill splits two short orders into two full-height columns', () => {
  const result = buildKitchenDisplayPresentation(
    Array.from({ length: 2 }, (_, index) => preparing(index + 1, undefined, [
      { quantity: 1, name: 'Marmita', note: '' },
    ])),
    timing,
    now,
    new Set(),
    { viewportWidth: 1920, viewportHeight: 1080 },
  )

  assert.equal(result.profile.columns, 2)
  assert.equal(result.cards.length, 2)
  assert.deepEqual(result.cards.map((card) => card.gridPosition.gridColumn), [1, 2])
  assert.equal(result.cards.every((card) => card.gridPosition.rowSpan === result.profile.gridRows), true)
})

test('adaptive fill keeps four short orders in a balanced two-by-two grid', () => {
  const result = buildKitchenDisplayPresentation(
    Array.from({ length: 4 }, (_, index) => preparing(index + 1, undefined, [
      { quantity: 1, name: 'Marmita', note: '' },
    ])),
    timing,
    now,
    new Set(),
    { viewportWidth: 1920, viewportHeight: 1080 },
  )

  assert.equal(result.profile.columns, 2)
  assert.equal(result.cards.length, 4)
  assert.deepEqual(result.cards.map((card) => card.gridPosition.gridColumn), [1, 2, 1, 2])
  assert.deepEqual(result.cards.map((card) => card.gridPosition.gridRow), [
    '1 / span 3',
    '1 / span 3',
    '4 / span 3',
    '4 / span 3',
  ])
  assert.equal(result.overflow, 0)
})


test('waiting scheduled work stays off-screen while any preparing order is in overflow', () => {
  const orders = [
    ...Array.from({ length: 7 }, (_, index) => preparing(index + 1)),
    scheduled(1),
  ]
  const result = buildKitchenDisplayPresentation(orders, timing, now)

  assert.deepEqual(result.cards.map(({ order }) => order.id), [
    'p-01', 'p-02', 'p-03', 'p-04', 'p-05', 'p-06',
  ])
  assert.equal(result.cards.some(({ phase }) => phase === 'scheduled'), false)
  assert.equal(result.overflow, 2)
})


test('presentation keeps scanning preparing work after one oversized card cannot fit', () => {
  const orders = [
    preparing(1),
    preparing(2),
    preparing(3),
    preparing(4),
    preparing(5),
    preparing(6, undefined, denseItems('Muito grande')),
    preparing(7),
  ]

  const result = buildKitchenDisplayPresentation(orders, timing, now)

  assert.deepEqual(result.cards.map(({ order }) => order.id), [
    'p-01', 'p-02', 'p-03', 'p-04', 'p-05', 'p-07',
  ])
  assert.equal(result.cards.some(({ order }) => order.id === 'p-06'), false)
  assert.equal(result.overflow, 1)
})


test('best-fit protects the highest-priority preparing prefix before maximizing visible card count', () => {
  const largePriorityItems = Array.from({ length: 13 }, (_, index) => ({
    quantity: 1,
    name: `Item ${index + 1}`,
    note: '',
  }))
  const orders = [
    preparing(1, '2026-09-22T14:10:00.000Z', largePriorityItems),
    ...Array.from({ length: 12 }, (_, index) => preparing(index + 2, '2026-09-22T14:50:00.000Z', [
      { quantity: 1, name: 'Marmita', note: '' },
    ])),
  ]

  const result = buildKitchenDisplayPresentation(
    orders,
    timing,
    now,
    new Set(),
    { viewportWidth: 960, viewportHeight: 540 },
  )

  assert.equal(result.cards.some(({ order }) => order.id === 'p-01'), true)
  assert.equal(result.cards[0]?.order.id, 'p-01')
  assert.equal(result.overflow > 0, true)
})


test('one oversized preparing order still renders alone on the full TV canvas', () => {
  const hugeItems = Array.from({ length: 11 }, (_, index) => ({
    quantity: 1,
    name: `Produto operacional grande ${index + 1}`,
    note: index % 2 === 0 ? `Observação de produção importante ${index + 1}` : '',
  }))
  const result = buildKitchenDisplayPresentation(
    [preparing(1, '2026-09-22T14:10:00.000Z', hugeItems)],
    timing,
    now,
    new Set(),
    { viewportWidth: 960, viewportHeight: 540 },
  )

  assert.equal(result.profile.columns, 1)
  assert.equal(result.cards.length, 1)
  assert.equal(result.cards[0]?.order.id, 'p-01')
  assert.equal(result.cards[0]?.gridPosition.gridRow, `1 / span ${result.profile.gridRows}`)
  assert.equal(result.overflow, 0)
})


test('four mixed orders keep one full-height large card plus three smaller cards in three columns', () => {
  const largeItems = [
    { quantity: 1, name: '[TESTE] Ovo Frito Un', note: '' },
    { quantity: 1, name: '[TESTE] Batata Frita P', note: 'Hhhhhh' },
    { quantity: 1, name: '[TESTE] Mousse de Chocolate Un', note: 'Teste observação' },
    { quantity: 1, name: '[TESTE] Porção de Arroz Un', note: '' },
    { quantity: 1, name: '[TESTE] Pudim Un', note: 'Observação' },
    { quantity: 1, name: 'Prato feito comercial Família', note: 'Sem ovo' },
    { quantity: 1, name: 'Marmita Churrasco M', note: '' },
    { quantity: 1, name: '[TESTE] Prato Executivo Un', note: 'Sem cebola' },
    { quantity: 1, name: '[TESTE] Marmita Frango P', note: '' },
    { quantity: 1, name: '[TESTE] Calabresa Acebolada G', note: '' },
    { quantity: 1, name: '[TESTE] Mandioca Frita M', note: '' },
  ]
  const orders = [
    preparing(1, '2026-09-22T14:10:00.000Z', largeItems),
    preparing(2, '2026-09-22T14:50:00.000Z', [{ quantity: 1, name: 'Marmita', note: '' }]),
    preparing(3, '2026-09-22T14:50:00.000Z', [{ quantity: 1, name: 'Refrigerante 2L', note: '' }]),
    preparing(4, '2026-09-22T14:50:00.000Z', [{ quantity: 1, name: 'Pudim', note: '' }]),
  ]

  const result = buildKitchenDisplayPresentation(
    orders,
    timing,
    now,
    new Set(),
    { viewportWidth: 960, viewportHeight: 540 },
  )

  assert.equal(result.profile.columns, 3)
  assert.equal(result.cards.length, 4)
  assert.equal(result.overflow, 0)
  assert.equal(result.cards[0]?.order.id, 'p-01')
  assert.equal(result.cards[0]?.gridPosition.rowSpan, result.profile.gridRows)
  assert.equal(result.cards[0]?.gridPosition.gridRow, `1 / span ${result.profile.gridRows}`)
  assert.deepEqual(result.cards.slice(1).map(({ order }) => order.id), ['p-02', 'p-03', 'p-04'])
})


test('five mixed orders keep one full-height large card plus four smaller cards without queue-size exceptions', () => {
  const largeItems = [
    { quantity: 1, name: '[TESTE] Ovo Frito Un', note: '' },
    { quantity: 1, name: '[TESTE] Batata Frita P', note: 'Hhhhhh' },
    { quantity: 1, name: '[TESTE] Mousse de Chocolate Un', note: 'Teste observação' },
    { quantity: 1, name: '[TESTE] Porção de Arroz Un', note: '' },
    { quantity: 1, name: '[TESTE] Pudim Un', note: 'Observação' },
    { quantity: 1, name: 'Prato feito comercial Família', note: 'Sem ovo' },
    { quantity: 1, name: 'Marmita Churrasco M', note: '' },
    { quantity: 1, name: '[TESTE] Prato Executivo Un', note: 'Sem cebola' },
    { quantity: 1, name: '[TESTE] Marmita Frango P', note: '' },
    { quantity: 1, name: '[TESTE] Calabresa Acebolada G', note: '' },
    { quantity: 1, name: '[TESTE] Mandioca Frita M', note: '' },
  ]
  const orders = [
    preparing(1, '2026-09-22T14:10:00.000Z', largeItems),
    preparing(2, '2026-09-22T14:50:00.000Z', [{ quantity: 1, name: 'Marmita', note: '' }]),
    preparing(3, '2026-09-22T14:50:00.000Z', [{ quantity: 1, name: 'Refrigerante 2L', note: '' }]),
    preparing(4, '2026-09-22T14:50:00.000Z', [{ quantity: 1, name: 'Pudim', note: '' }]),
    preparing(5, '2026-09-22T14:50:00.000Z', [{ quantity: 1, name: 'Batata', note: '' }]),
  ]

  const result = buildKitchenDisplayPresentation(
    orders,
    timing,
    now,
    new Set(),
    { viewportWidth: 960, viewportHeight: 540 },
  )

  assert.equal(result.profile.columns, 3)
  assert.equal(result.cards.length, 5)
  assert.equal(result.overflow, 0)
  assert.equal(result.cards[0]?.order.id, 'p-01')
  assert.equal(result.cards[0]?.gridPosition.rowSpan, result.profile.gridRows)
  assert.equal(result.cards[0]?.gridPosition.gridRow, `1 / span ${result.profile.gridRows}`)
  assert.deepEqual(result.cards.slice(1).map(({ order }) => order.id), ['p-02', 'p-03', 'p-04', 'p-05'])
})


test('multipage builder uses the existing best-fit repeatedly without creating empty pages', () => {
  const orders = Array.from({ length: 13 }, (_, index) => preparing(index + 1))
  const result = buildKitchenDisplayPages(orders, timing, now)

  assert.equal(result.totalVisible, 13)
  assert.deepEqual(result.pages.map(({ cards }) => cards.length), [6, 6, 1])
  assert.equal(result.pages.every(({ cards }) => cards.length > 0), true)
  assert.deepEqual(result.unrenderableOrderIds, [])

  const ids = result.pages.flatMap(({ cards }) => cards.map(({ order }) => order.id))
  assert.equal(new Set(ids).size, 13)
  assert.deepEqual(ids, orders.map(({ id }) => id))
  assert.deepEqual(
    result.pages.map(({ counts }) => counts),
    Array.from({ length: 3 }, () => ({ preparing: 13, late: 0, scheduled: 0 })),
  )
  assert.deepEqual(result.pages.map(({ overflow }) => overflow), [7, 1, 0])
})

test('multipage builder keeps waiting scheduled work behind preparing overflow, then includes it later', () => {
  const orders = [
    ...Array.from({ length: 8 }, (_, index) => preparing(index + 1)),
    scheduled(1),
    scheduled(2),
  ]
  const result = buildKitchenDisplayPages(orders, timing, now)

  assert.equal(result.pages.length, 2)
  assert.deepEqual(
    result.pages[0].cards.map(({ phase }) => phase),
    Array.from({ length: 6 }, () => 'preparing'),
  )
  assert.deepEqual(
    result.pages[1].cards.map(({ phase }) => phase),
    ['preparing', 'preparing', 'scheduled', 'scheduled'],
  )
  assert.deepEqual(result.pages[1].counts, { preparing: 8, late: 0, scheduled: 2 })
  assert.equal(result.pages[1].overflow, 0)
})

test('multipage builder stops safely and reports an order that cannot render even alone', () => {
  const impossibleItems = Array.from({ length: 80 }, (_, index) => ({
    quantity: 1,
    name: `Produto extremamente grande família completa especial ${index + 1}`,
    note: 'Observação extensa para produção embalagem separada e conferência',
  }))
  const orders = [
    preparing(1, undefined, impossibleItems),
    preparing(2),
    preparing(3),
  ]
  const result = buildKitchenDisplayPages(orders, timing, now, new Set(), {
    viewportWidth: 960,
    viewportHeight: 540,
  })

  assert.equal(result.pages.length >= 1, true)
  assert.deepEqual(
    result.pages.flatMap(({ cards }) => cards.map(({ order }) => order.id)),
    ['p-02', 'p-03'],
  )
  assert.deepEqual(result.unrenderableOrderIds, ['p-01'])
  assert.equal(result.totalVisible, 3)
})

test('multipage page one stays compatible with the existing presentation contract', () => {
  const orders = Array.from({ length: 8 }, (_, index) => preparing(index + 1))
  const legacy = buildKitchenDisplayPresentation(orders, timing, now)
  const paged = buildKitchenDisplayPages(orders, timing, now)

  assert.equal(paged.pages.length, 2)
  assert.equal(paged.pages[0].profile.id, legacy.profile.id)
  assert.deepEqual(
    paged.pages[0].cards.map(({ order }) => order.id),
    legacy.cards.map(({ order }) => order.id),
  )
  assert.deepEqual(paged.pages[0].counts, legacy.counts)
  assert.equal(paged.pages[0].overflow, legacy.overflow)
})

test('multipage builder returns no empty page for an empty kitchen queue', () => {
  assert.deepEqual(buildKitchenDisplayPages([], timing, now), {
    pages: [],
    totalVisible: 0,
    unrenderableOrderIds: [],
  })
})

test('future-day schedules and distant Local reservations stay out of TV cards and counters until operational', () => {
  const futureDelivery = {
    id: 'future-delivery',
    orderNumber: 7001,
    status: 'Em preparo',
    type: 'Entrega',
    client: 'Entrega amanhã',
    createdAt: '2026-09-22T12:00:00.000Z',
    orderDate: '2026-09-23',
    scheduledFor: '2026-09-23T15:00:00.000Z',
    items: [{ quantity: 1, name: 'Marmita', note: '' }],
  }
  const distantReservation = {
    id: 'future-reservation',
    orderNumber: 7002,
    status: 'Em preparo',
    type: 'Local',
    client: 'Mesa 4 · Ana',
    createdAt: '2026-09-22T12:00:00.000Z',
    orderDate: '2026-10-22',
    scheduledFor: '2026-10-22T18:00:00.000Z',
    tableReservationId: 'reservation-7002',
    tableReservationStatus: 'reserved',
    items: [{ quantity: 1, name: 'Lanche', note: '' }],
  }

  const result = buildKitchenDisplayPresentation(
    [futureDelivery, distantReservation],
    timing,
    now,
    new Set(),
    { viewportWidth: 1280, viewportHeight: 720 },
  )

  assert.deepEqual(result.cards, [])
  assert.deepEqual(result.counts, { preparing: 0, late: 0, scheduled: 0 })
  assert.equal(result.overflow, 0)

  const pages = buildKitchenDisplayPages(
    [futureDelivery, distantReservation],
    timing,
    now,
    new Set(),
    { viewportWidth: 1280, viewportHeight: 720 },
  )
  assert.deepEqual(pages, { pages: [], totalVisible: 0, unrenderableOrderIds: [] })
})

test('a Local reservation becomes a normal Local TV card when its operational window starts', () => {
  const reservation = {
    id: 'reservation-operational',
    orderNumber: 7003,
    status: 'Em preparo',
    type: 'Local',
    client: 'Mesa 7 · Joana',
    createdAt: '2026-09-22T12:00:00.000Z',
    orderDate: '2026-09-23',
    scheduledFor: '2026-09-23T15:00:00.000Z',
    tableReservationId: 'reservation-7003',
    tableReservationStatus: 'reserved',
    items: [{ quantity: 1, name: 'Prato executivo', note: '' }],
  }
  const atOperationalStart = new Date('2026-09-23T14:10:00.000Z')
  const result = buildKitchenDisplayPresentation(
    [reservation],
    timing,
    atOperationalStart,
    new Set(),
    { viewportWidth: 1280, viewportHeight: 720 },
  )

  assert.equal(result.cards.length, 1)
  assert.equal(result.cards[0].order.id, 'reservation-operational')
  assert.equal(result.cards[0].order.type, 'Local')
  assert.equal(result.cards[0].phase, 'preparing')
  assert.deepEqual(result.counts, { preparing: 1, late: 0, scheduled: 0 })
})
