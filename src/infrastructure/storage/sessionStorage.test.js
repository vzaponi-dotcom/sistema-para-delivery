import test from 'node:test'
import assert from 'node:assert/strict'
import { getSessionStorage } from './sessionStorage.js'

test('session storage adapter returns the explicit browser session storage', () => {
  const storage = { getItem() {}, setItem() {} }
  assert.equal(getSessionStorage({ sessionStorage: storage }), storage)
})

test('session storage adapter is safe without a browser or when access throws', () => {
  assert.equal(getSessionStorage(undefined), undefined)
  assert.equal(getSessionStorage({ get sessionStorage() { throw new Error('blocked') } }), undefined)
})
