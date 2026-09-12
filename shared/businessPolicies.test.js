import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_OPERATIONS,
  DEFAULT_PAYMENT_METHODS,
  LEGACY_TIMING,
  parseOperations,
  parsePaymentMethods,
  parsePrintingPolicy,
  paymentCode,
  paymentLabel,
} from './businessPolicies.js'

const expectSettingsInvalid = (fn, field) => assert.throws(fn, (error) => (
  error?.status === 400
  && error?.code === 'SETTINGS_INVALID'
  && (!field || error?.field === field)
))

test('defaults preserve the approved legacy timings, modalities and payment order as immutable values', () => {
  assert.deepEqual(LEGACY_TIMING, {
    scheduledPrepLeadMinutes: 50,
    scheduledLateGraceMinutes: 15,
    immediateLateAfterMinutes: 30,
    immediateVeryLateAfterMinutes: 40,
  })
  assert.deepEqual(DEFAULT_OPERATIONS, {
    timing: LEGACY_TIMING,
    enabledModalities: ['Entrega', 'Retirada', 'Local'],
    defaultModality: 'Entrega',
  })
  assert.deepEqual(DEFAULT_PAYMENT_METHODS, {
    methods: [
      { code: 'pix', active: true, sortOrder: 0 },
      { code: 'cash', active: true, sortOrder: 1 },
      { code: 'debit_card', active: true, sortOrder: 2 },
      { code: 'credit_card', active: true, sortOrder: 3 },
      { code: 'transfer', active: true, sortOrder: 4 },
      { code: 'other', active: true, sortOrder: 5 },
    ],
    defaultMethod: 'pix',
  })
  assert.equal(Object.isFrozen(DEFAULT_OPERATIONS), true)
  assert.equal(Object.isFrozen(DEFAULT_OPERATIONS.timing), true)
  assert.equal(Object.isFrozen(DEFAULT_OPERATIONS.enabledModalities), true)
  assert.equal(Object.isFrozen(DEFAULT_PAYMENT_METHODS.methods[0]), true)
})

test('parseOperations accepts the complete contract and rejects unknown keys, invalid ranges and disabled defaults', () => {
  assert.deepEqual(parseOperations(structuredClone(DEFAULT_OPERATIONS)), DEFAULT_OPERATIONS)
  assert.deepEqual(parseOperations({
    timing: {
      scheduledPrepLeadMinutes: 0,
      scheduledLateGraceMinutes: 0,
      immediateLateAfterMinutes: 180,
      immediateVeryLateAfterMinutes: 181,
    },
    enabledModalities: ['Local'],
    defaultModality: 'Local',
  }).timing, {
    scheduledPrepLeadMinutes: 0,
    scheduledLateGraceMinutes: 0,
    immediateLateAfterMinutes: 180,
    immediateVeryLateAfterMinutes: 181,
  })
  assert.deepEqual(parseOperations({
    timing: {
      scheduledPrepLeadMinutes: 240,
      scheduledLateGraceMinutes: 120,
      immediateLateAfterMinutes: 1,
      immediateVeryLateAfterMinutes: 240,
    },
    enabledModalities: ['Entrega'],
    defaultModality: 'Entrega',
  }).timing, {
    scheduledPrepLeadMinutes: 240,
    scheduledLateGraceMinutes: 120,
    immediateLateAfterMinutes: 1,
    immediateVeryLateAfterMinutes: 240,
  })

  const invalidCases = [
    [{ ...structuredClone(DEFAULT_OPERATIONS), unexpected: true }, 'unexpected'],
    [{ ...structuredClone(DEFAULT_OPERATIONS), timing: { ...LEGACY_TIMING, unexpected: 1 } }, 'timing.unexpected'],
    [{ ...structuredClone(DEFAULT_OPERATIONS), timing: { ...LEGACY_TIMING, scheduledPrepLeadMinutes: -1 } }, 'timing.scheduledPrepLeadMinutes'],
    [{ ...structuredClone(DEFAULT_OPERATIONS), timing: { ...LEGACY_TIMING, scheduledPrepLeadMinutes: 240.5 } }, 'timing.scheduledPrepLeadMinutes'],
    [{ ...structuredClone(DEFAULT_OPERATIONS), timing: { ...LEGACY_TIMING, scheduledPrepLeadMinutes: 241 } }, 'timing.scheduledPrepLeadMinutes'],
    [{ ...structuredClone(DEFAULT_OPERATIONS), timing: { ...LEGACY_TIMING, scheduledLateGraceMinutes: 121 } }, 'timing.scheduledLateGraceMinutes'],
    [{ ...structuredClone(DEFAULT_OPERATIONS), timing: { ...LEGACY_TIMING, immediateLateAfterMinutes: 0 } }, 'timing.immediateLateAfterMinutes'],
    [{ ...structuredClone(DEFAULT_OPERATIONS), timing: { ...LEGACY_TIMING, immediateLateAfterMinutes: 181 } }, 'timing.immediateLateAfterMinutes'],
    [{ ...structuredClone(DEFAULT_OPERATIONS), timing: { ...LEGACY_TIMING, immediateLateAfterMinutes: Number.NaN } }, 'timing.immediateLateAfterMinutes'],
    [{ ...structuredClone(DEFAULT_OPERATIONS), timing: { ...LEGACY_TIMING, immediateVeryLateAfterMinutes: 30 } }, 'timing.immediateVeryLateAfterMinutes'],
    [{ ...structuredClone(DEFAULT_OPERATIONS), timing: { ...LEGACY_TIMING, immediateVeryLateAfterMinutes: 241 } }, 'timing.immediateVeryLateAfterMinutes'],
    [{ ...structuredClone(DEFAULT_OPERATIONS), enabledModalities: [] }, 'enabledModalities'],
    [{ ...structuredClone(DEFAULT_OPERATIONS), enabledModalities: ['Entrega', 'Entrega'] }, 'enabledModalities'],
    [{ ...structuredClone(DEFAULT_OPERATIONS), enabledModalities: ['Entrega', 'Motoboy'] }, 'enabledModalities'],
    [{ ...structuredClone(DEFAULT_OPERATIONS), enabledModalities: ['Retirada'], defaultModality: 'Entrega' }, 'defaultModality'],
  ]

  for (const [value, field] of invalidCases) expectSettingsInvalid(() => parseOperations(value), field)
})

test('payment mapping preserves stable labels and every accepted historical Portuguese value', () => {
  const pairs = [
    ['pix', 'Pix'],
    ['cash', 'Dinheiro'],
    ['debit_card', 'Cartão de débito'],
    ['credit_card', 'Cartão de crédito'],
    ['transfer', 'Transferência'],
    ['other', 'Outro'],
  ]

  for (const [code, label] of pairs) {
    assert.equal(paymentCode(code), code)
    assert.equal(paymentCode(label), code)
    assert.equal(paymentLabel(code), label)
  }
})

test('parsePaymentMethods requires the six native methods once, unique positions and an active default', () => {
  assert.deepEqual(parsePaymentMethods(structuredClone(DEFAULT_PAYMENT_METHODS)), DEFAULT_PAYMENT_METHODS)

  const missing = structuredClone(DEFAULT_PAYMENT_METHODS)
  missing.methods.pop()
  expectSettingsInvalid(() => parsePaymentMethods(missing), 'methods')

  const duplicateCode = structuredClone(DEFAULT_PAYMENT_METHODS)
  duplicateCode.methods[5].code = 'pix'
  expectSettingsInvalid(() => parsePaymentMethods(duplicateCode), 'methods')

  const duplicateOrder = structuredClone(DEFAULT_PAYMENT_METHODS)
  duplicateOrder.methods[5].sortOrder = 0
  expectSettingsInvalid(() => parsePaymentMethods(duplicateOrder), 'methods')

  const inactiveDefault = structuredClone(DEFAULT_PAYMENT_METHODS)
  inactiveDefault.methods[0].active = false
  expectSettingsInvalid(() => parsePaymentMethods(inactiveDefault), 'defaultMethod')

  const decimalOrder = structuredClone(DEFAULT_PAYMENT_METHODS)
  decimalOrder.methods[0].sortOrder = 0.5
  expectSettingsInvalid(() => parsePaymentMethods(decimalOrder), 'methods.0.sortOrder')

  const unknownItemKey = structuredClone(DEFAULT_PAYMENT_METHODS)
  unknownItemKey.methods[0].label = 'Pix'
  expectSettingsInvalid(() => parsePaymentMethods(unknownItemKey), 'methods.0.label')
})

test('parsePrintingPolicy accepts only a complete two-context policy with one or two copies', () => {
  assert.deepEqual(parsePrintingPolicy({ orderDefaultCopies: 2, tableTabDefaultCopies: 1 }), {
    orderDefaultCopies: 2,
    tableTabDefaultCopies: 1,
  })
  assert.deepEqual(parsePrintingPolicy({ orderDefaultCopies: 1, tableTabDefaultCopies: 2 }), {
    orderDefaultCopies: 1,
    tableTabDefaultCopies: 2,
  })
  expectSettingsInvalid(() => parsePrintingPolicy({}), 'orderDefaultCopies')
  expectSettingsInvalid(() => parsePrintingPolicy({ orderDefaultCopies: 1.5, tableTabDefaultCopies: 1 }), 'orderDefaultCopies')
  expectSettingsInvalid(() => parsePrintingPolicy({ orderDefaultCopies: 2, tableTabDefaultCopies: 3 }), 'tableTabDefaultCopies')
  expectSettingsInvalid(() => parsePrintingPolicy({ orderDefaultCopies: 2, tableTabDefaultCopies: 1, defaultCopies: 2 }), 'defaultCopies')
})
