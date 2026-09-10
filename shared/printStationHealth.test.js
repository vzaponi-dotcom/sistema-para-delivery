import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizePrinterHealth } from './printStationHealth.js'

const base = { qzConnected: true, configuredQueueFound: true }

test('physical OK is ready only with connected QZ and discovered configured queue', () => {
  assert.deepEqual(normalizePrinterHealth({ ...base, physicalStatus: { text: 'PRINTER OK', code: 0 } }), {
    state: 'ready',
    ready: true,
  })
  assert.equal(normalizePrinterHealth({ ...base, physicalStatus: { text: 'PRINTER OK', code: 0 }, qzConnected: false }).ready, false)
  assert.equal(normalizePrinterHealth({ ...base, physicalStatus: { text: 'PRINTER OK', code: 0 }, configuredQueueFound: false }).ready, false)
})

test('known physical blocking statuses fail closed with normalized states', () => {
  assert.equal(normalizePrinterHealth({ ...base, physicalStatus: { text: 'PRINTER OFFLINE', code: 67108864 } }).state, 'printer_offline')
  assert.equal(normalizePrinterHealth({ ...base, physicalStatus: { text: 'PRINTER OK', code: 67108864 } }).state, 'printer_offline')
  for (const text of ['PAPER OUT', 'PRINTER ERROR', 'INTERVENTION REQUIRED']) {
    assert.equal(normalizePrinterHealth({ ...base, physicalStatus: { text } }).state, 'printer_attention', text)
  }
})

test('QZ statusText payloads use the same fail-closed classification', () => {
  assert.equal(normalizePrinterHealth({ ...base, statusText: 'PAPER OUT', statusCode: 12 }).state, 'printer_attention')
})

test('unknown and verifying physical states remain not ready', () => {
  for (const physicalStatus of [{ text: 'PRINTER WARMING' }, { text: 'verifying' }, undefined]) {
    const health = normalizePrinterHealth({ ...base, physicalStatus })
    assert.equal(health.state, 'verifying')
    assert.equal(health.ready, false)
  }
})
