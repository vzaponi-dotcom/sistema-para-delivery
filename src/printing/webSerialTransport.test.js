import assert from 'node:assert/strict'
import test from 'node:test'
import { MTP5_PROFILE } from './mtp5Profile.js'
import {
  isWebSerialSupported,
  probeSerialPort,
  requestPrinterPort,
  writeSerialBytes,
} from './webSerialTransport.js'

const fakePort = ({ openError = null, writeError = null, closeError = null } = {}) => {
  const calls = []
  const writer = {
    async write(bytes) {
      calls.push(['write', [...bytes]])
      if (writeError) throw writeError
    },
    releaseLock() { calls.push(['releaseLock']) },
  }
  return {
    calls,
    writable: { getWriter: () => { calls.push(['getWriter']); return writer } },
    async open(options) {
      calls.push(['open', options])
      if (openError) throw openError
    },
    async close() {
      calls.push(['close'])
      if (closeError) throw closeError
    },
  }
}

test('Web Serial capability and user-gesture port request use the normal paired-device chooser', async () => {
  assert.equal(isWebSerialSupported(undefined), false)
  assert.equal(isWebSerialSupported({ requestPort() {}, getPorts() {} }), true)

  await assert.rejects(
    () => requestPrinterPort(undefined),
    (error) => error.code === 'WEB_SERIAL_UNSUPPORTED',
  )

  const selected = { id: 'printer' }
  let requestArgs = 'not-called'
  const serial = {
    requestPort: async (...args) => { requestArgs = args; return selected },
    getPorts: async () => [],
  }
  assert.equal(await requestPrinterPort(serial), selected)
  assert.deepEqual(requestArgs, [])
})

test('serial probe opens and closes with the MTP5 serial profile without writing bytes', async () => {
  const port = fakePort()
  await probeSerialPort(port, MTP5_PROFILE.serial)
  assert.deepEqual(port.calls, [
    ['open', MTP5_PROFILE.serial],
    ['close'],
  ])
})

test('successful serial print is one open-write-close transaction', async () => {
  const port = fakePort()
  const bytes = Uint8Array.from([1, 2, 3])

  await writeSerialBytes(port, bytes, MTP5_PROFILE.serial)

  assert.deepEqual(port.calls, [
    ['open', MTP5_PROFILE.serial],
    ['getWriter'],
    ['write', [1, 2, 3]],
    ['releaseLock'],
    ['close'],
  ])
})

test('failure before writing is a known connection failure', async () => {
  const port = fakePort({ openError: new Error('offline') })
  await assert.rejects(
    () => writeSerialBytes(port, Uint8Array.from([1]), MTP5_PROFILE.serial),
    (error) => error.code === 'SERIAL_OPEN_FAILED' && error.message.includes('conectar'),
  )
  assert.deepEqual(port.calls, [['open', MTP5_PROFILE.serial]])
})

test('failure after write begins is physically uncertain and is never downgraded to a known failure', async () => {
  const port = fakePort({ writeError: new Error('link dropped') })
  await assert.rejects(
    () => writeSerialBytes(port, Uint8Array.from([1]), MTP5_PROFILE.serial),
    (error) => error.code === 'SERIAL_WRITE_UNCERTAIN',
  )
  assert.equal(port.calls.filter(([name]) => name === 'write').length, 1)
  assert.equal(port.calls.some(([name]) => name === 'releaseLock'), true)
})

test('close failure after a completed write remains physically uncertain', async () => {
  const port = fakePort({ closeError: new Error('close failed') })
  await assert.rejects(
    () => writeSerialBytes(port, Uint8Array.from([1]), MTP5_PROFILE.serial),
    (error) => error.code === 'SERIAL_WRITE_UNCERTAIN',
  )
})
