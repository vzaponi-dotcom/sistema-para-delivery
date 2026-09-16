import test from 'node:test'
import assert from 'node:assert/strict'

import { hasCapability, legacyCapabilities } from '../access.js'
import { NAVIGATION_DESTINATIONS as destinations } from './registry.js'
import {
  decideNavigation,
  getMobilePageDirection,
  resolveArea,
  resolveDestination,
  resolveHome,
  resolveNavigationEntry,
} from './resolution.js'

const implemented = new Set(destinations.map(({ id }) => id))

test('Financeiro sem dashboard abre A receber', () => {
  assert.equal(resolveArea('finance', new Set(['finance.receivables']), implemented), 'receivables')
})

test('destino dashboard explicitamente negado não faz fallback', () => {
  assert.deepEqual(resolveDestination('dashboard', new Set(['finance.receivables']), implemented), { status: 'denied' })
})

test('conjunto vazio permanece sem liberação', () => {
  assert.equal(resolveArea('finance', new Set(), implemented), null)
  assert.equal(hasCapability(new Set(), 'finance.overview'), false)
})

test('capacidade desconhecida não concede acesso', () => {
  const granted = new Set(['finance.future'])
  assert.equal(hasCapability(granted, 'finance.future'), false)
  assert.equal(resolveArea('finance', granted, implemented), null)
})

test('áreas usam fallbacks estáveis de Pedidos, Financeiro e Configurações', () => {
  assert.equal(resolveArea('orders', new Set(['orders.history']), implemented), 'history')
  assert.equal(resolveArea('finance', new Set(['finance.movements']), implemented), 'finance')
  assert.equal(resolveArea('settings', new Set(['preferences.local']), implemented), 'settings-home')
})

test('destino desconhecido é rejeitado sem fallback', () => {
  assert.deepEqual(resolveDestination('future-page', legacyCapabilities(true), implemented), { status: 'unknown' })
})

test('destino conhecido ainda não implementado fica indisponível', () => {
  assert.deepEqual(resolveDestination('settings-device', new Set(['preferences.local']), new Set(['orders'])), { status: 'unavailable' })
})

test('ordem dos destinos permanece estável após filtragem', () => {
  assert.equal(resolveArea('finance', new Set(['finance.receivables', 'finance.movements']), implemented), 'receivables')
})

test('decideNavigation respeita precedência de recusa, checkout, descarte e navegação', () => {
  assert.equal(decideNavigation({ allowed: false, checkoutPending: true, dirtyOrder: true, leavingOrder: true }), 'reject')
  assert.equal(decideNavigation({ allowed: true, checkoutPending: true, dirtyOrder: true, leavingOrder: true }), 'blocked')
  assert.equal(decideNavigation({ allowed: true, checkoutPending: false, dirtyOrder: true, leavingOrder: true }), 'confirm')
  assert.equal(decideNavigation({ allowed: true, checkoutPending: false, dirtyOrder: true, leavingOrder: false }), 'navigate')
})

test('salvamento de Configurações não participa da guarda de navegação', () => {
  assert.equal(decideNavigation({ allowed: true, checkoutPending: false, dirtyOrder: false, leavingOrder: false, settingsPending: true }), 'navigate')
})

test('adaptador legado concede capacidades explicitamente apenas autenticado', () => {
  assert.equal(legacyCapabilities(false).size, 0)
  assert.equal(hasCapability(legacyCapabilities(true), 'orders.view'), true)
  assert.equal(hasCapability(legacyCapabilities(true), 'printing.station.configure'), true)
})

test('home e entry por área mantêm fallback atual', () => {
  const subset = new Set(['orders', 'history', 'dashboard', 'receivables', 'finance'])
  assert.equal(resolveHome(new Set(['finance.receivables']), subset), 'receivables')
  assert.deepEqual(resolveNavigationEntry(
    { area: 'finance', label: 'Financeiro' },
    new Set(['finance.receivables']),
    subset,
  ), { area: 'finance', label: 'Financeiro', id: 'receivables' })
})

test('direção mobile preserva none para destinos fora da lista histórica', () => {
  assert.equal(getMobilePageDirection('orders', 'history'), 'forward')
  assert.equal(getMobilePageDirection('history', 'orders'), 'backward')
  assert.equal(getMobilePageDirection('settings-home', 'settings-payments'), 'none')
})
