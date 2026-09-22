import test from 'node:test'
import assert from 'node:assert/strict'

import { bootstrapKitchenDisplay, readPairingToken } from './kitchenDisplaySession.js'

test('fragment token is paired, scrubbed from the URL, never persisted, then state is read', async () => {
  const events = []
  const storage = { setItem: () => events.push('persisted') }
  const location = { hash: '#token=pair-secret', pathname: '/cozinha-tv', search: '' }
  const history = { replaceState: (_state, _title, url) => events.push(`scrub:${url}`) }
  const result = await bootstrapKitchenDisplay({
    location,
    history,
    localStorage: storage,
    sessionStorage: storage,
    pair: async (token) => events.push(`pair:${token}`),
    readState: async () => { events.push('state'); return { orders: [] } },
  })

  assert.deepEqual(events, ['pair:pair-secret', 'scrub:/cozinha-tv', 'state'])
  assert.deepEqual(result, { orders: [] })
})

test('fragment is scrubbed even when pairing fails and parser ignores query tokens', async () => {
  const replaced = []
  assert.equal(readPairingToken({ hash: '', search: '?token=leak' }), null)
  await assert.rejects(() => bootstrapKitchenDisplay({
    location: { hash: '#token=bad', pathname: '/cozinha-tv', search: '?theme=dark' },
    history: { replaceState: (_state, _title, url) => replaced.push(url) },
    pair: async () => { throw new Error('invalid') },
    readState: async () => assert.fail('must not read state after failed pairing'),
  }))
  assert.deepEqual(replaced, ['/cozinha-tv?theme=dark'])
})

test('without a fragment bootstrap reads cookie-backed state directly', async () => {
  let paired = false
  const state = await bootstrapKitchenDisplay({
    location: { hash: '', pathname: '/cozinha-tv', search: '' },
    history: { replaceState: () => assert.fail('must not rewrite clean URL') },
    pair: async () => { paired = true },
    readState: async () => ({ orders: [{ id: 'one' }] }),
  })
  assert.equal(paired, false)
  assert.equal(state.orders[0].id, 'one')
})
