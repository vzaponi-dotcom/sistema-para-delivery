import assert from 'node:assert/strict'
import test from 'node:test'
import {
  RAWBT_URL_PREFIX,
  bytesToRawBtBase64,
  createRawBtUrl,
  dispatchRawBtBytes,
} from './rawBtTransport.js'

test('RawBT transport encodes ESC/POS bytes as a base64 custom-scheme URL', () => {
  const bytes = Uint8Array.from([0x1b, 0x40, 0x0a])
  const encode = (binary) => Buffer.from(binary, 'binary').toString('base64')

  assert.equal(RAWBT_URL_PREFIX, 'rawbt:base64,')
  assert.equal(bytesToRawBtBase64(bytes, encode), 'G0AK')
  assert.equal(createRawBtUrl(bytes, encode), 'rawbt:base64,G0AK')
})

test('RawBT transport dispatches the exact rendered bytes through Android navigation', () => {
  const calls = []
  const bytes = Uint8Array.from([1, 2, 3, 255])
  const encode = (binary) => Buffer.from(binary, 'binary').toString('base64')

  const result = dispatchRawBtBytes(bytes, {
    encodeBase64: encode,
    navigate: (url) => calls.push(url),
  })

  assert.deepEqual(calls, ['rawbt:base64,AQID/w=='])
  assert.deepEqual(result, { dispatched: true, url: 'rawbt:base64,AQID/w==' })
})

test('RawBT transport reports a known launch failure before handing the job to the driver', () => {
  assert.throws(
    () => dispatchRawBtBytes(Uint8Array.from([1]), {
      encodeBase64: () => 'AQ==',
      navigate: () => { throw new Error('blocked') },
    }),
    (error) => error.code === 'RAWBT_LAUNCH_FAILED' && error.message.includes('RawBT'),
  )
})

test('RawBT transport rejects non-byte payloads instead of silently corrupting tickets', () => {
  assert.throws(
    () => createRawBtUrl([1, 2, 3], () => 'ignored'),
    (error) => error instanceof TypeError,
  )
})
