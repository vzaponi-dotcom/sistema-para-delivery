import test from 'node:test'
import assert from 'node:assert/strict'
import { preparePolicyGuards, readOrderModalityExpectation, readPaymentMethodExpectation, readPaymentMethodExpectations } from './operationalPolicyGuards.js'
import { createSettingsDb } from './test-support/settingsDb.js'

const BUSINESS = 'amor-e-sabor'

test('server reads active native payment and modality expectations from the business policy', async (t) => {
  const { db, close } = createSettingsDb()
  t.after(close)
  assert.deepEqual(await readPaymentMethodExpectation(db, BUSINESS, 'Dinheiro'), { revision: 1, code: 'cash' })
  assert.deepEqual(await readOrderModalityExpectation(db, BUSINESS, 'Retirada'), { revision: 1, modality: 'Retirada' })
})

test('inactive selections are rejected before operational statements are prepared', async (t) => {
  const { db, sqlite, close } = createSettingsDb()
  t.after(close)
  sqlite.exec("UPDATE business_payment_methods SET active = 0 WHERE code = 'cash'; UPDATE business_order_modalities SET active = 0 WHERE code = 'Retirada'")
  await assert.rejects(readPaymentMethodExpectation(db, BUSINESS, 'Dinheiro'), { status: 409, code: 'POLICY_CHANGED' })
  await assert.rejects(readOrderModalityExpectation(db, BUSINESS, 'Retirada'), { status: 409, code: 'POLICY_CHANGED' })
})

test('same-batch policy guards abort atomically when policy changes after validation', async (t) => {
  const { db, sqlite, close } = createSettingsDb()
  t.after(close)
  const paymentMethods = await readPaymentMethodExpectation(db, BUSINESS, 'Dinheiro')
  const operations = await readOrderModalityExpectation(db, BUSINESS, 'Retirada')
  sqlite.exec("UPDATE business_payment_methods SET active = 0 WHERE code = 'cash'; UPDATE business_payment_settings SET revision = revision + 1; UPDATE business_order_modalities SET active = 0 WHERE code = 'Retirada'; UPDATE business_operation_settings SET revision = revision + 1")
  const txId = 'policy-race'
  await assert.rejects(db.batch(preparePolicyGuards(db, BUSINESS, { paymentMethods, operations }, txId)), /POLICY_CHANGED/)
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM settings_tx_assertions').get().n, 0)
})

test('server resolves multiple active payment methods under one revision with server-owned labels', async (t) => {
  const { db, close } = createSettingsDb()
  t.after(close)
  assert.deepEqual(await readPaymentMethodExpectations(db, BUSINESS, ['cash', 'pix']), {
    revision: 1,
    methods: [
      { code: 'cash', label: 'Dinheiro' },
      { code: 'pix', label: 'Pix' },
    ],
  })
})

test('multi-method policy expectation rejects one inactive selection and same-batch guards protect every selected method', async (t) => {
  const { db, sqlite, close } = createSettingsDb()
  t.after(close)

  sqlite.exec("UPDATE business_payment_methods SET active = 0 WHERE code = 'cash'")
  await assert.rejects(readPaymentMethodExpectations(db, BUSINESS, ['cash', 'pix']), { status: 409, code: 'POLICY_CHANGED' })

  sqlite.exec("UPDATE business_payment_methods SET active = 1 WHERE code = 'cash'")
  const paymentMethods = await readPaymentMethodExpectations(db, BUSINESS, ['cash', 'pix'])
  sqlite.exec("BEGIN; UPDATE business_payment_settings SET default_method = 'cash', revision = revision + 1; UPDATE business_payment_methods SET active = 0 WHERE code = 'pix'; COMMIT")
  await assert.rejects(
    db.batch(preparePolicyGuards(db, BUSINESS, { paymentMethods }, 'multi-policy-race')),
    /POLICY_CHANGED/,
  )
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM settings_tx_assertions').get().n, 0)
})
