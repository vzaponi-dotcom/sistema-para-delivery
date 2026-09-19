import test from 'node:test'
import assert from 'node:assert/strict'
import { getDefaultPrintStationName, isQzPrintStationEligible } from './stationPolicy.js'

test('default station names remain deterministic', () => {
  assert.equal(getDefaultPrintStationName('windows'), 'Cozinha · Windows')
  assert.equal(getDefaultPrintStationName('android'), 'Cozinha · Android')
  assert.equal(getDefaultPrintStationName('other'), 'Cozinha · Navegador')
  assert.equal(getDefaultPrintStationName('unexpected'), 'Cozinha · Navegador')
})

test('only Windows with a configured QZ printer is locally eligible', () => {
  assert.equal(isQzPrintStationEligible({ platform: 'windows', qzPrinterName: 'MPT-II' }), true)
  assert.equal(isQzPrintStationEligible({ platform: 'windows', qzPrinterName: '' }), false)
  assert.equal(isQzPrintStationEligible({ platform: 'android', qzPrinterName: 'MPT-II' }), false)
  assert.equal(isQzPrintStationEligible({ platform: 'other', qzPrinterName: 'MPT-II' }), false)
})
