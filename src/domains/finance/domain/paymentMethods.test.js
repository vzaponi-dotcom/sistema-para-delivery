import test from 'node:test'
import assert from 'node:assert/strict'
import {
  paymentDefaultFromEffective,
  paymentOptionsFromEffective,
  paymentOptionsWithSelection,
  paymentSelectionNeedsReview,
} from './paymentMethods.js'

const config = {
  paymentMethods: {
    methods: [
      { code: 'cash', value: 'Dinheiro', label: 'Dinheiro', active: true },
      { code: 'pix', value: 'Pix', label: 'Pix', active: false },
    ],
    defaultMethod: 'cash',
  },
}

test('effective payment projection preserves ordering and never invents Pix', () => {
  assert.deepEqual(paymentOptionsFromEffective(config), [
    { code: 'cash', value: 'Dinheiro', label: 'Dinheiro' },
  ])
  assert.equal(paymentDefaultFromEffective(config), 'Dinheiro')
  assert.deepEqual(paymentOptionsFromEffective(null), [])
  assert.equal(paymentDefaultFromEffective(null), '')
})

test('inactive open selection is preserved only as a review option', () => {
  const active = paymentOptionsFromEffective(config)

  assert.equal(paymentSelectionNeedsReview(active, 'Transferência'), true)
  assert.deepEqual(paymentOptionsWithSelection(active, 'Transferência')[0], {
    value: 'Transferência',
    label: 'Transferência (inativo)',
    code: null,
    inactive: true,
  })
})
