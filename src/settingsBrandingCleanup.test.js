import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = (relativePath) => fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8')

const settingsEditors = [
  './app/surfaces/settings/OperationSettings.jsx',
  './domains/finance/ui/settings/PaymentSettings.jsx',
  './app/surfaces/settings/CancellationSettings.jsx',
  './domains/finance/ui/settings/FinanceCategorySettings.jsx',
]

test('settings editors do not render product/version footers', () => {
  for (const relativePath of settingsEditors) {
    const file = source(relativePath)
    assert.doesNotMatch(file, /footerNote=/, `${relativePath} should not inject a product/version footer`)
    assert.doesNotMatch(file, /Gestão Delivery\s*·\s*v\d/i, `${relativePath} should not expose legacy product/version copy`)
  }
})
