import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const dialogUrl = new URL('./RegisterRefundDialog.jsx', import.meta.url)

const readDialog = () => fs.readFileSync(dialogUrl, 'utf8')

test('register refund dialog exists and requires a refund method', () => {
  assert.equal(fs.existsSync(dialogUrl), true, 'RegisterRefundDialog.jsx must exist')
  const source = readDialog()

  assert.match(source, /function RegisterRefundDialog\(\{ open, order, onClose, onConfirm, submitting \}\)/)
  assert.match(source, /refundMethod/)
  assert.match(source, /SystemSelect/)
  assert.match(source, /Forma de estorno/)
  assert.match(source, /disabled=\{[^}]*!refundMethod/)
})

test('register refund dialog suggests original payment method and keeps amount read-only', () => {
  assert.equal(fs.existsSync(dialogUrl), true, 'RegisterRefundDialog.jsx must exist')
  const source = readDialog()

  assert.match(source, /order\?\.paymentMethod/)
  assert.match(source, /paidAmount/)
  assert.match(source, /valor integral|valor total|100%/i)
  assert.doesNotMatch(source, /<input[^>]*(?:amount|valor)[^>]*>/i)
})

test('register refund submit payload contains method only', () => {
  assert.equal(fs.existsSync(dialogUrl), true, 'RegisterRefundDialog.jsx must exist')
  const source = readDialog()

  assert.match(source, /onConfirm\(\{\s*refundMethod\s*\}\)/)
  assert.doesNotMatch(source, /onConfirm\(\{[^}]*amount/)
})
