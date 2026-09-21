import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const srcRoot = path.dirname(fileURLToPath(import.meta.url))

const productionFilesUnder = (relativeRoot) => {
  const root = path.join(srcRoot, relativeRoot)
  if (!existsSync(root)) return []
  const files = []
  const visit = (directory) => {
    for (const entry of readdirSync(directory)) {
      const fullPath = path.join(directory, entry)
      if (statSync(fullPath).isDirectory()) visit(fullPath)
      else if (/\.(?:js|jsx|mjs)$/.test(entry) && !/\.test\.[^.]+$/.test(entry)) files.push(fullPath)
    }
  }
  visit(root)
  return files
}

test('C10 closes residual generic production roots with real owners', () => {
  assert.deepEqual(productionFilesUnder('components'), [])
  assert.deepEqual(productionFilesUnder('utils'), [])

  for (const relativePath of [
    'app/shell/BrandLogo.jsx',
    'app/shell/ConnectionBanner.jsx',
    'app/shell/LoginScreen.jsx',
    'app/shell/theme/ThemeProvider.jsx',
    'app/shell/theme/themeContext.js',
    'app/shell/theme/theme.js',
    'app/runtime/data/dataSync.js',
    'domains/orders/ui/PaymentBadge.jsx',
    'domains/orders/ui/payment.css',
    'domains/printing/ui/OrderTicketPreview.jsx',
    'domains/printing/ui/PrintStatusBadge.jsx',
    'domains/printing/ui/TableTabTicketPreview.jsx',
  ]) {
    assert.equal(existsSync(path.join(srcRoot, relativePath)), true, relativePath)
  }

  assert.equal(existsSync(path.join(srcRoot, 'utils/bodyScrollLock.js')), false)
})

test('C10 keeps external Printing presentation consumers on the public entry', () => {
  const violations = []
  for (const file of productionFilesUnder('.')) {
    const relative = path.relative(srcRoot, file).replaceAll(path.sep, '/')
    if (relative.startsWith('domains/printing/')) continue
    const source = readFileSync(file, 'utf8')
    if (/domains\/printing\/ui\/(?:OrderTicketPreview|PrintStatusBadge|TableTabTicketPreview)/.test(source)) {
      violations.push(relative)
    }
  }
  assert.deepEqual(violations, [])
})
