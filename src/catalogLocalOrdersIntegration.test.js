import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const appShell = readFileSync(new URL('./components/AppShell.jsx', import.meta.url), 'utf8')
const newOrder = readFileSync(new URL('./pages/NewOrder.jsx', import.meta.url), 'utf8')
const newOrderCustomerStep = readFileSync(new URL('./components/NewOrderCustomerStep.jsx', import.meta.url), 'utf8')
const receivables = readFileSync(new URL('./pages/Receivables.jsx', import.meta.url), 'utf8')
const repositories = readFileSync(new URL('../worker/repositories.js', import.meta.url), 'utf8')

test('approved catalog and local-order round stays wired across app surfaces', () => {
  assert.match(app, /ProductForm/)
  assert.match(appShell, /DashboardPeriodProvider/)
  assert.match(newOrder, /customerIdentity/)
  assert.match(newOrder, /guest_name/)
  assert.match(newOrder, /table/)
  assert.match(newOrder, /registered_client/)
  assert.doesNotMatch(receivables, /Clientes devendo/)
  assert.match(receivables, /Pendências por identificação/)
  assert.match(receivables, /groupPendingOrders/)
})

test('table tab integration stays wired across persistence, app, receivables and new order', () => {
  assert.match(repositories, /table_tab_id/)
  assert.match(repositories, /getOrCreateOpenTableTab/)
  assert.match(receivables, /table_tab/)
  assert.match(app, /tableTabs/)
  assert.match(newOrderCustomerStep, /comanda aberta/)
})
