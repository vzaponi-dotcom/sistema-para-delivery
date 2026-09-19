import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { useOrderPaymentWorkflow } from './useOrderPaymentWorkflow.js'

const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail })
  return { promise, resolve, reject }
}

const order = (id, overrides = {}) => ({
  id,
  client: `Cliente ${id}`,
  type: 'Entrega',
  status: 'Em preparo',
  paymentStatus: 'Pendente',
  total: 40,
  ...overrides,
})

const paidEffects = (source, method = 'Pix') => ({
  order: { ...source, paymentStatus: 'Pago', paymentMethod: method, paidAmount: source.total },
  movement: { id: `m-${source.id}`, type: 'entrada', value: source.total, source: 'order-payment' },
  tableTab: null,
})

const paymentOptions = [
  { code: 'pix', value: 'Pix', label: 'Pix' },
  { code: 'cash', value: 'Dinheiro', label: 'Dinheiro' },
]

async function mountWorkflow(overrides = {}) {
  let latest
  let renderer
  let requestKey = null
  const keys = []
  const effects = []
  const successes = []
  const errors = []
  let refreshCalls = 0
  let guard = 1
  let orders = overrides.orders || [order('a')]
  const props = {
    api: overrides.api || { registerOrderPayment: async () => paidEffects(orders[0]) },
    orders,
    granted: overrides.granted || new Set(['orders.view', 'orders.history', 'payments.receive']),
    canReceivePayments: overrides.canReceivePayments ?? true,
    writesBlocked: overrides.writesBlocked ?? false,
    paymentOptions,
    defaultPaymentMethod: 'Pix',
    getSyncGuard: () => guard,
    applyOfficialEffects: (effect) => effects.push(effect),
    refreshOfficialData: async () => { refreshCalls += 1 },
    setRequestKey: (value) => {
      requestKey = typeof value === 'function' ? value(requestKey) : value
      keys.push(requestKey)
    },
    onSuccess: (message) => successes.push(message),
    onError: (error) => errors.push(error),
    ...overrides.props,
  }

  function Probe(currentProps) {
    latest = useOrderPaymentWorkflow(currentProps)
    return null
  }

  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Probe, props))
  })

  return {
    getLatest: () => latest,
    effects,
    keys,
    successes,
    errors,
    getRefreshCalls: () => refreshCalls,
    setGuard: (value) => { guard = value },
    setOrders: async (nextOrders) => {
      orders = nextOrders
      await act(async () => renderer.update(React.createElement(Probe, { ...props, orders })))
    },
    unmount: () => renderer.unmount(),
  }
}

test('double submit sends one request and applies the authoritative response once', async () => {
  const source = order('101')
  const pending = deferred()
  const calls = []
  const probe = await mountWorkflow({
    orders: [source],
    api: {
      registerOrderPayment: (...args) => {
        calls.push(args)
        return pending.promise
      },
    },
  })

  await act(async () => assert.equal(probe.getLatest().open(source.id, 'orders'), true))
  let first
  await act(async () => {
    first = probe.getLatest().dialog.submit()
    assert.equal(await probe.getLatest().dialog.submit(), false)
  })
  assert.equal(calls.length, 1)

  const official = paidEffects(source)
  await act(async () => {
    pending.resolve(official)
    assert.equal(await first, true)
  })

  assert.deepEqual(probe.effects, [official])
  assert.equal(probe.getLatest().dialog, null)
  assert.deepEqual(probe.successes, ['Pagamento recebido via Pix'])
  probe.unmount()
})

test('response A applies official effects without closing or changing target B', async () => {
  const orderA = order('201')
  const orderB = order('202', { status: 'Finalizado' })
  const pendingA = deferred()
  const pendingB = deferred()
  const calls = []
  const probe = await mountWorkflow({
    orders: [orderA, orderB],
    api: {
      registerOrderPayment: (id, method) => {
        calls.push([id, method])
        return id === orderA.id ? pendingA.promise : pendingB.promise
      },
    },
  })

  await act(async () => probe.getLatest().open(orderA.id, 'orders'))
  let submissionA
  await act(async () => { submissionA = probe.getLatest().dialog.submit() })
  await act(async () => probe.getLatest().close())
  await act(async () => probe.getLatest().open(orderB.id, 'history'))
  await act(async () => probe.getLatest().dialog.setMethod('Dinheiro'))
  let submissionB
  await act(async () => { submissionB = probe.getLatest().dialog.submit() })

  await act(async () => {
    pendingA.resolve(paidEffects(orderA, 'Pix'))
    await submissionA
  })

  assert.equal(probe.getLatest().dialog.order.id, orderB.id)
  assert.equal(probe.getLatest().dialog.method, 'Dinheiro')
  assert.equal(probe.getLatest().dialog.submitting, true)
  assert.deepEqual(probe.successes, [])

  await act(async () => {
    pendingB.resolve(paidEffects(orderB, 'Dinheiro'))
    await submissionB
  })
  assert.deepEqual(calls, [[orderA.id, 'Pix'], [orderB.id, 'Dinheiro']])
  probe.unmount()
})

test('stale session guard ignores an old payment response', async () => {
  const source = order('301')
  const pending = deferred()
  const probe = await mountWorkflow({
    orders: [source],
    api: { registerOrderPayment: () => pending.promise },
  })

  await act(async () => probe.getLatest().open(source.id, 'orders'))
  let submission
  await act(async () => { submission = probe.getLatest().dialog.submit() })
  probe.setGuard(2)

  await act(async () => {
    pending.resolve(paidEffects(source))
    assert.equal(await submission, false)
  })

  assert.deepEqual(probe.effects, [])
  assert.deepEqual(probe.successes, [])
  probe.unmount()
})

test('409 refreshes official data once without retrying POST', async () => {
  const source = order('401')
  const calls = []
  const conflict = Object.assign(new Error('Conflito'), { status: 409 })
  const probe = await mountWorkflow({
    orders: [source],
    api: {
      registerOrderPayment: async (...args) => {
        calls.push(args)
        throw conflict
      },
    },
  })

  await act(async () => probe.getLatest().open(source.id, 'orders'))
  await act(async () => assert.equal(await probe.getLatest().dialog.submit(), false))

  assert.equal(calls.length, 1)
  assert.equal(probe.getRefreshCalls(), 1)
  assert.deepEqual(probe.effects, [])
  assert.equal(probe.errors[0], conflict)
  assert.equal(probe.getLatest().dialog.submitting, false)
  probe.unmount()
})

test('network uncertainty refreshes official data without optimistic payment or POST retry', async () => {
  const source = order('501')
  const calls = []
  const error = new TypeError('network')
  const probe = await mountWorkflow({
    orders: [source],
    api: {
      registerOrderPayment: async (...args) => {
        calls.push(args)
        throw error
      },
    },
  })

  await act(async () => probe.getLatest().open(source.id, 'orders'))
  await act(async () => assert.equal(await probe.getLatest().dialog.submit(), false))

  assert.equal(calls.length, 1)
  assert.equal(probe.getRefreshCalls(), 1)
  assert.deepEqual(probe.effects, [])
  assert.equal(probe.getLatest().dialog.order.paymentStatus, 'Pendente')
  assert.equal(probe.errors[0], error)
  probe.unmount()
})

test('Receivables opens the same workflow without operational source eligibility', async () => {
  const source = order('601', { status: 'Finalizado' })
  const probe = await mountWorkflow({
    orders: [source],
    granted: new Set(['payments.receive']),
  })

  await act(async () => assert.equal(probe.getLatest().open(source.id), true))
  assert.equal(probe.getLatest().dialog.order.id, source.id)
  assert.equal(probe.getLatest().dialog.method, 'Pix')
  probe.unmount()
})
