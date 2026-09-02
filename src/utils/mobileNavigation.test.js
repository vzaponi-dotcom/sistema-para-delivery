import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MOBILE_SECTION_IDS,
  getAdjacentMobileSection,
  getSwipeDirection,
  shouldIgnoreNavigationSwipe,
} from './mobileNavigation.js'

test('mobile sections keep the approved navigation order', () => {
  assert.deepEqual(MOBILE_SECTION_IDS, [
    'dashboard',
    'orders',
    'clients',
    'products',
    'receivables',
    'finance',
  ])
})

test('adjacent mobile navigation moves one section and never wraps', () => {
  assert.equal(getAdjacentMobileSection('dashboard', 'previous'), 'dashboard')
  assert.equal(getAdjacentMobileSection('dashboard', 'next'), 'orders')
  assert.equal(getAdjacentMobileSection('products', 'next'), 'receivables')
  assert.equal(getAdjacentMobileSection('finance', 'next'), 'finance')
})

test('swipe direction requires dominant horizontal travel above threshold', () => {
  assert.equal(getSwipeDirection({ deltaX: -80, deltaY: 12, threshold: 56 }), 'next')
  assert.equal(getSwipeDirection({ deltaX: 80, deltaY: 12, threshold: 56 }), 'previous')
  assert.equal(getSwipeDirection({ deltaX: -40, deltaY: 4, threshold: 56 }), null)
  assert.equal(getSwipeDirection({ deltaX: -80, deltaY: 90, threshold: 56 }), null)
})

test('navigation swipe ignores controls horizontal areas dialogs listboxes and overlay opt-outs', () => {
  const makeTarget = ({ tagName = 'DIV', role = null, horizontal = false, overlay = false } = {}) => ({
    tagName,
    closest: (selector) => {
      if (horizontal && selector.includes('[data-horizontal-interaction]')) return {}
      if (overlay && selector.includes('[data-navigation-swipe-block]')) return {}
      if (role === 'dialog' && selector.includes('[role="dialog"]')) return {}
      if (role === 'listbox' && selector.includes('[role="listbox"]')) return {}
      return null
    },
  })

  assert.equal(shouldIgnoreNavigationSwipe(makeTarget({ tagName: 'INPUT' })), true)
  assert.equal(shouldIgnoreNavigationSwipe(makeTarget({ tagName: 'BUTTON' })), true)
  assert.equal(shouldIgnoreNavigationSwipe(makeTarget({ role: 'dialog' })), true)
  assert.equal(shouldIgnoreNavigationSwipe(makeTarget({ role: 'listbox' })), true)
  assert.equal(shouldIgnoreNavigationSwipe(makeTarget({ horizontal: true })), true)
  assert.equal(shouldIgnoreNavigationSwipe(makeTarget({ overlay: true })), true)
  assert.equal(shouldIgnoreNavigationSwipe(makeTarget()), false)
})
