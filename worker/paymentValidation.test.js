import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assertPaymentAllocationTotal,
  validatePaymentAllocations,
} from './paymentValidation.js'

const rejectsValidation = (fn, field = 'allocations') => assert.throws(fn, (error) => (
  error?.status === 400
  && error?.code === 'VALIDATION_ERROR'
  && error?.field === field
))

test('payment allocation validation accepts one or many canonical methods using integer cents', () => {
  assert.deepEqual(validatePaymentAllocations([
    { methodCode: 'pix', amountCents: 8000 },
  ]), [
    { methodCode: 'pix', amountCents: 8000 },
  ])

  assert.deepEqual(validatePaymentAllocations([
    { methodCode: 'cash', amountCents: 3000 },
    { methodCode: 'pix', amountCents: 5000 },
  ]), [
    { methodCode: 'cash', amountCents: 3000 },
    { methodCode: 'pix', amountCents: 5000 },
  ])
})

test('payment allocation validation rejects malformed, empty, duplicate and unknown methods', () => {
  for (const value of [undefined, null, {}, 'pix', []]) {
    rejectsValidation(() => validatePaymentAllocations(value))
  }

  rejectsValidation(() => validatePaymentAllocations([
    { methodCode: '', amountCents: 100 },
  ]), 'allocations.0.methodCode')

  rejectsValidation(() => validatePaymentAllocations([
    { methodCode: 'Cheque', amountCents: 100 },
  ]), 'allocations.0.methodCode')

  rejectsValidation(() => validatePaymentAllocations([
    { methodCode: 'cash', amountCents: 50 },
    { methodCode: 'cash', amountCents: 50 },
  ]))
})

test('payment allocation validation rejects non-positive, fractional and unsafe cent values', () => {
  for (const amountCents of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '100']) {
    rejectsValidation(() => validatePaymentAllocations([
      { methodCode: 'pix', amountCents },
    ]), 'allocations.0.amountCents')
  }
})

test('payment allocation total must exactly equal the authoritative integer total', () => {
  const allocations = validatePaymentAllocations([
    { methodCode: 'cash', amountCents: 3000 },
    { methodCode: 'pix', amountCents: 5000 },
  ])

  assert.doesNotThrow(() => assertPaymentAllocationTotal(allocations, 8000))
  rejectsValidation(() => assertPaymentAllocationTotal(allocations, 7999))
  rejectsValidation(() => assertPaymentAllocationTotal(allocations, 8001))
  rejectsValidation(() => assertPaymentAllocationTotal(allocations, 8000.5), 'authoritativeTotalCents')
  rejectsValidation(() => assertPaymentAllocationTotal(allocations, Number.MAX_SAFE_INTEGER + 1), 'authoritativeTotalCents')
})
