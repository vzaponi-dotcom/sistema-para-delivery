import test from 'node:test'
import assert from 'node:assert/strict'
import { createTenancyFixture } from '../test-support/tenancyDb.js'
import { prepareBusinessDefaults } from './businessDefaults.js'
import { DEFAULT_OPERATIONS, DEFAULT_PAYMENT_METHODS } from '../../shared/businessPolicies.js'
import { nativeCancellationReasons, nativeFinanceCategories } from '../../shared/settingsCatalogs.js'
import { loadOperations } from '../operationSettingsRepository.js'
import { loadPaymentMethods } from '../paymentSettingsRepository.js'
import { loadCancellationReasons } from '../cancellationSettingsRepository.js'
import { loadFinanceCategories } from '../financeCategoryRepository.js'
import { loadPrintingPolicy } from '../printSettingsRepository.js'

test('new company initializes versioned native defaults without tenant data or credentials', async t => {
  const f = await createTenancyFixture(t), businessId = crypto.randomUUID()
  const statements = prepareBusinessDefaults(f.db, { businessId, name: 'New Company', now: f.now })
  await f.db.batch(statements)
  const operations = await loadOperations(f.db, businessId)
  assert.deepEqual(operations.data, DEFAULT_OPERATIONS)
  assert.equal(operations.revision, 1)
  assert.deepEqual((await loadPaymentMethods(f.db, businessId)).data, DEFAULT_PAYMENT_METHODS)
  assert.deepEqual((await loadCancellationReasons(f.db, businessId)).data.items, nativeCancellationReasons().items.map(({ id, label, active, sortOrder }) => ({ id, label, active, sortOrder })))
  assert.deepEqual((await loadFinanceCategories(f.db, businessId)).data.items, nativeFinanceCategories().items.map(({ id, type, label, active, sortOrder }) => ({ id, type, label, active, sortOrder })))
  assert.deepEqual((await loadPrintingPolicy(f.db, businessId)).data, { orderDefaultCopies: 2, tableTabDefaultCopies: 1 })
  const profile = f.sqlite.prepare('SELECT * FROM business_profiles WHERE business_id = ?').get(businessId)
  assert.equal(profile.phone, '')
  assert.equal(profile.logo_object_key, null)
  assert.equal(profile.revision, 1)
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM roles WHERE business_id = ?').get(businessId).n, 2)
  for (const table of ['products', 'clients', 'orders', 'tables', 'table_tabs', 'movements', 'print_jobs', 'print_stations', 'auth_credentials']) {
    assert.equal(f.sqlite.prepare(`SELECT count(*) n FROM ${table} WHERE business_id = ?`).get(businessId).n, 0, table)
  }
  assert.equal(f.sqlite.prepare('SELECT access_status FROM businesses WHERE id = ?').get(businessId).access_status, 'pending')
  assert.deepEqual(f.sqlite.prepare('PRAGMA foreign_key_check').all(), [])
})
