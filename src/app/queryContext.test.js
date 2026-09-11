import test from 'node:test'
import assert from 'node:assert/strict'

import { createQueryContext, patchQueryContext } from './queryContext.js'
import { DEFAULT_PRINT_QUEUE_QUERY } from '../pages/printQueueQuery.js'

test('períodos de Dashboard e Histórico são independentes', () => {
  const initial = createQueryContext()
  const next = patchQueryContext(initial, 'dashboard', { period: '7d' })

  assert.equal(next.dashboard.period, '7d')
  assert.equal(next.history.analysisPeriod, '30d')
  assert.equal(initial.dashboard.period, '30d')
})

test('alterar uma página preserva todas as outras referências', () => {
  const initial = createQueryContext()
  const next = patchQueryContext(initial, 'products', {
    search: 'bolo',
    categoryFilter: 'Sobremesas',
  })

  assert.deepEqual(next.products, {
    search: 'bolo',
    categoryFilter: 'Sobremesas',
  })
  assert.equal(next.orders, initial.orders)
  assert.equal(next.receivables, initial.receivables)
})

test('um contexto novo restaura todos os defaults permitidos', () => {
  const context = createQueryContext()

  assert.deepEqual(context, {
    orders: { search: '' },
    history: { filter: 'all', analysisPeriod: '30d' },
    dashboard: { period: '30d', valuesVisible: true },
    clients: { search: '', sort: 'name-asc' },
    products: { search: '', categoryFilter: 'Todos' },
    receivables: {
      search: '',
      activeView: 'pending',
      timingFilter: 'all',
      sortMode: 'urgency',
      exactDateFilter: null,
      selectedEntryKey: null,
    },
    printQueue: { ...DEFAULT_PRINT_QUEUE_QUERY },
  })
  assert.notEqual(context.printQueue, DEFAULT_PRINT_QUEUE_QUERY)
})

test('contexto não contém coleções oficiais nem estado transitório', () => {
  const context = createQueryContext()

  for (const forbidden of [
    'ordersData',
    'clientsData',
    'productsData',
    'movements',
    'tableTabs',
    'modals',
    'confirmations',
    'actionMenus',
    'bulkSelection',
  ]) {
    assert.equal(Object.hasOwn(context, forbidden), false)
  }
})

test('patch desconhecido ou campo fora do contrato não amplia o contexto', () => {
  const initial = createQueryContext()

  assert.equal(patchQueryContext(initial, 'finance', { search: 'novo' }), initial)
  assert.deepEqual(
    patchQueryContext(initial, 'orders', { search: 'ana', ordersData: [{}] }).orders,
    { search: 'ana' },
  )
})
