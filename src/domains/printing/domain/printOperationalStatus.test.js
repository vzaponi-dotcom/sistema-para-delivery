import assert from 'node:assert/strict'
import test from 'node:test'
import { derivePrintOperationalStatus } from './printOperationalStatus.js'

const remotePrimary = (overrides = {}) => ({
  id: 'windows-primary',
  name: 'Cozinha Windows',
  platform: 'windows',
  isPrimary: true,
  physicalState: 'ready',
  health: {
    online: true,
    qzReady: true,
    printerReady: true,
    ready: true,
  },
  ...overrides,
})

const androidSecondary = (overrides = {}) => ({
  id: 'android-secondary',
  name: 'PC Victor',
  platform: 'android',
  isPrimary: false,
  health: {
    online: false,
    qzReady: false,
    printerReady: false,
    ready: false,
  },
  ...overrides,
})

const deriveRemote = (primary = remotePrimary(), local = androidSecondary()) => derivePrintOperationalStatus({
  stations: [local, primary],
  localStation: local,
  transportKind: 'queue-only',
  printerState: 'unsupported',
  qzConnected: false,
  configuredPrinterName: null,
  printerQueueFound: false,
  printerHealth: { state: 'verifying', ready: false },
})

const deriveLocalPrimary = (overrides = {}) => {
  const localStation = remotePrimary({
    id: 'local-windows',
    name: 'Cozinha Local',
    ...overrides.localStation,
  })
  return derivePrintOperationalStatus({
    stations: overrides.stations ?? [localStation],
    localStation,
    transportKind: 'qz',
    printerState: overrides.printerState ?? 'connected',
    qzConnected: overrides.qzConnected ?? true,
    configuredPrinterName: Object.prototype.hasOwnProperty.call(overrides, 'configuredPrinterName')
      ? overrides.configuredPrinterName
      : 'Elgin i9',
    printerQueueFound: overrides.printerQueueFound ?? true,
    printerHealth: overrides.printerHealth ?? { state: 'ready', ready: true },
  })
}

test('queue-only viewer uses the healthy Windows primary instead of its own local QZ state', () => {
  const result = deriveRemote()

  assert.equal(result.code, 'ready')
  assert.equal(result.primaryStation.id, 'windows-primary')
  assert.equal(result.isLocalPrimary, false)
  assert.equal(result.source, 'heartbeat')
  assert.equal(result.physicalState, 'ready')
})

test('a secondary local station is never promoted when no primary is known', () => {
  const local = androidSecondary()
  const result = derivePrintOperationalStatus({
    stations: [local],
    localStation: local,
    transportKind: 'queue-only',
  })

  assert.deepEqual(result, {
    code: 'no_primary',
    primaryStation: null,
    isLocalPrimary: false,
    source: 'none',
    physicalState: null,
  })
})

test('local primary is a valid fallback while the stations collection is incomplete', () => {
  const result = deriveLocalPrimary({ stations: [] })

  assert.equal(result.code, 'ready')
  assert.equal(result.primaryStation.id, 'local-windows')
  assert.equal(result.isLocalPrimary, true)
  assert.equal(result.source, 'local')
})

test('remote primary explicitly offline is primary_offline', () => {
  const result = deriveRemote(remotePrimary({
    health: { online: false, qzReady: false, printerReady: false, ready: false },
  }))

  assert.equal(result.code, 'primary_offline')
  assert.equal(result.source, 'heartbeat')
})

test('remote primary online with QZ unavailable is qz_unavailable', () => {
  const result = deriveRemote(remotePrimary({
    health: { online: true, qzReady: false, printerReady: false, ready: false },
  }))

  assert.equal(result.code, 'qz_unavailable')
})

test('remote primary online with QZ ready but printer not ready is printer_unavailable', () => {
  const result = deriveRemote(remotePrimary({
    physicalState: 'printer_offline',
    health: { online: true, qzReady: true, printerReady: false, ready: false },
  }))

  assert.equal(result.code, 'printer_unavailable')
  assert.equal(result.physicalState, 'printer_offline')
})

test('missing remote heartbeat health is verifying instead of false offline', () => {
  const result = deriveRemote(remotePrimary({ health: undefined }))

  assert.equal(result.code, 'verifying')
  assert.equal(result.source, 'heartbeat')
})

test('missing remote readiness fields is verifying instead of inventing a failure', () => {
  const result = deriveRemote(remotePrimary({ health: { online: true } }))

  assert.equal(result.code, 'verifying')
})

test('an offline secondary station does not degrade a healthy primary', () => {
  const local = androidSecondary({
    health: { online: false, qzReady: false, printerReady: false, ready: false },
  })
  const result = derivePrintOperationalStatus({
    stations: [remotePrimary(), local],
    localStation: local,
    transportKind: 'queue-only',
    qzConnected: false,
    printerQueueFound: false,
    printerHealth: { state: 'printer_offline', ready: false },
  })

  assert.equal(result.code, 'ready')
})

test('local primary connecting stays verifying', () => {
  const result = deriveLocalPrimary({
    printerState: 'connecting',
    qzConnected: false,
    configuredPrinterName: null,
    printerQueueFound: false,
    printerHealth: { state: 'verifying', ready: false },
  })

  assert.equal(result.code, 'verifying')
})

test('local primary disconnected reports QZ unavailable', () => {
  const result = deriveLocalPrimary({
    printerState: 'disconnected',
    qzConnected: false,
    configuredPrinterName: 'Elgin i9',
    printerQueueFound: false,
    printerHealth: { state: 'verifying', ready: false },
  })

  assert.equal(result.code, 'qz_unavailable')
})

test('local primary only reports printer unconfigured after QZ is known connected', () => {
  const result = deriveLocalPrimary({
    printerState: 'unconfigured',
    qzConnected: true,
    configuredPrinterName: null,
    printerQueueFound: false,
    printerHealth: { state: 'verifying', ready: false },
  })

  assert.equal(result.code, 'printer_unconfigured')
})

test('ambiguous initial local primary state is verifying rather than false unconfigured', () => {
  const result = deriveLocalPrimary({
    printerState: 'unconfigured',
    qzConnected: false,
    configuredPrinterName: null,
    printerQueueFound: false,
    printerHealth: { state: 'verifying', ready: false },
  })

  assert.equal(result.code, 'verifying')
})

test('local primary with configured printer but missing queue is printer unavailable', () => {
  const result = deriveLocalPrimary({
    printerState: 'connected',
    qzConnected: true,
    configuredPrinterName: 'Elgin i9',
    printerQueueFound: false,
    printerHealth: { state: 'verifying', ready: false },
  })

  assert.equal(result.code, 'printer_unavailable')
})

test('local primary physical ready is ready', () => {
  const result = deriveLocalPrimary()

  assert.equal(result.code, 'ready')
  assert.equal(result.source, 'local')
  assert.equal(result.physicalState, 'ready')
})

test('local primary physical offline or attention is printer unavailable', () => {
  for (const state of ['printer_offline', 'printer_attention']) {
    const result = deriveLocalPrimary({
      printerHealth: { state, ready: false },
    })

    assert.equal(result.code, 'printer_unavailable')
    assert.equal(result.physicalState, state)
  }
})

test('local primary physical verification stays verifying', () => {
  const result = deriveLocalPrimary({
    printerHealth: { state: 'verifying', ready: false },
  })

  assert.equal(result.code, 'verifying')
})


test('task 5 edge-state matrix keeps unknown, secondary and local transient states safe', () => {
  const secondary = androidSecondary()
  assert.equal(derivePrintOperationalStatus({
    stations: [],
    localStation: secondary,
    transportKind: 'queue-only',
  }).code, 'no_primary')

  assert.equal(deriveRemote(remotePrimary({ health: undefined })).code, 'verifying')
  assert.equal(deriveRemote(remotePrimary({ health: { online: true } })).code, 'verifying')
  assert.equal(deriveRemote(remotePrimary({
    health: { online: true, qzReady: false, printerReady: false, ready: false },
  })).code, 'qz_unavailable')

  const genericPrinterFailure = deriveRemote(remotePrimary({
    physicalState: 'verifying',
    health: { online: true, qzReady: true, printerReady: false, ready: false },
  }))
  assert.equal(genericPrinterFailure.code, 'printer_unavailable')

  assert.equal(deriveLocalPrimary({
    printerState: 'connecting',
    qzConnected: false,
    configuredPrinterName: null,
    printerQueueFound: false,
    printerHealth: { state: 'verifying', ready: false },
  }).code, 'verifying')
  assert.equal(deriveLocalPrimary({
    printerState: 'disconnected',
    qzConnected: false,
  }).code, 'qz_unavailable')
  assert.equal(deriveLocalPrimary({
    printerState: 'unconfigured',
    qzConnected: true,
    configuredPrinterName: null,
    printerQueueFound: false,
  }).code, 'printer_unconfigured')
  assert.equal(deriveLocalPrimary({
    printerHealth: { state: 'printer_attention', ready: false },
  }).code, 'printer_unavailable')

  const offlineSecondary = androidSecondary({
    health: { online: false, qzReady: false, printerReady: false, ready: false },
  })
  assert.equal(derivePrintOperationalStatus({
    stations: [remotePrimary(), offlineSecondary],
    localStation: offlineSecondary,
    transportKind: 'queue-only',
  }).code, 'ready')
})


test('QA round 2: configured local primary stays QZ unavailable while reconnect health is transiently verifying', () => {
  const result = deriveLocalPrimary({
    printerState: 'verifying',
    qzConnected: false,
    configuredPrinterName: 'MPT-II',
    printerQueueFound: true,
    printerHealth: { state: 'verifying', ready: false },
  })

  assert.equal(result.code, 'qz_unavailable')
})
