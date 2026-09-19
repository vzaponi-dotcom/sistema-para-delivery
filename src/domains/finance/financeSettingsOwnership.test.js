import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('legacy app-owned Finance settings owners are absent', () => {
  for (const path of [
    new URL('../../app/surfaces/settings/PaymentSettings.jsx', import.meta.url),
    new URL('../../app/surfaces/settings/FinanceCategorySettings.jsx', import.meta.url),
    new URL('../../app/surfaces/settings/paymentSettingsModel.js', import.meta.url),
  ]) assert.equal(fs.existsSync(path), false, String(path))
})
