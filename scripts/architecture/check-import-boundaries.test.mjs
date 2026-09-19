import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { findArchitectureViolations } from './check-import-boundaries.mjs'

const createFixture = async (t) => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'delivery-architecture-'))
  t.after(() => rm(rootDir, { recursive: true, force: true }))
  const write = async (relativePath, content) => {
    const target = path.join(rootDir, relativePath)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, content)
  }
  return { rootDir, write }
}

test('domain layer cannot import React', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/domains/orders/domain/rules.js', "import React from 'react'\n")
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.some((value) => value.includes('domain-react')))
})

test('shared cannot import domains', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/shared/utils/a.js', "import { x } from '../../domains/orders/index.js'\n")
  await write('src/domains/orders/index.js', 'export const x = 1\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.some((value) => value.includes('shared-domain')))
})

test('cross-domain consumers must use the public index entry point', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/domains/finance/application/internal.js', "import { x } from '../../orders/domain/x.js'\n")
  await write('src/domains/orders/domain/x.js', 'export const x = 1\n')
  let violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.some((value) => value.includes('cross-domain-internal')))

  await write('src/domains/finance/application/internal.js', "import { x } from '../../orders/index.js'\n")
  await write('src/domains/orders/index.js', 'export const x = 1\n')
  violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.equal(violations.some((value) => value.includes('cross-domain-internal')), false)
})

test('direct qz-tray imports require infrastructure/qz or an exact legacy allowance', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/printing/usePrintingManager.js', "import qz from 'qz-tray'\n")
  await write('src/printing/anotherManager.js', "import qz from 'qz-tray'\n")
  const violations = await findArchitectureViolations({
    rootDir,
    allowlist: { qzDirectImports: ['src/printing/usePrintingManager.js'] },
  })
  assert.equal(violations.some((value) => value.includes('usePrintingManager.js') && value.includes('qz-direct')), false)
  assert.ok(violations.some((value) => value.includes('anotherManager.js') && value.includes('qz-direct')))
})

test('qz dependency imports in test files do not create production architecture violations', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/printing/usePrintingManager.test.js', "import qz from 'qz-tray'\n")
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.equal(violations.some((value) => value.includes('qz-direct')), false)
})

test('policy editing cannot import the concrete Settings surface', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/app/policy-editing/controller.js', "import { registry } from '../surfaces/settings/policies/registry.js'\n")
  await write('src/app/surfaces/settings/policies/registry.js', 'export const registry = []\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.some((value) => value.includes('policy-settings-surface')))
})

test('policy editing cannot import pages or printing runtime', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/app/policy-editing/controller.js', "import Settings from '../../pages/Settings.jsx'\nimport { print } from '../../printing/runtime.js'\n")
  await write('src/pages/Settings.jsx', 'export default null\n')
  await write('src/printing/runtime.js', 'export const print = () => {}\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.some((value) => value.includes('policy-concrete-ui')))
  assert.ok(violations.some((value) => value.includes('policy-printing')))
})

test('navigation cannot import the concrete Settings surface', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/app/navigation/controller.js', "import { registry } from '../surfaces/settings/policies/registry.js'\n")
  await write('src/app/surfaces/settings/policies/registry.js', 'export const registry = []\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.some((value) => value.includes('navigation-settings-surface')))
})

test('C3 legacy Settings owners are rejected even when they are compatibility reexports', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/app/settingsState.js', "export * from './policy-editing/policyEditingState.js'\n")
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.some((value) => value.includes('c3-legacy-owner')))
})

test('App cannot import legacy Settings owners or concrete policy adapters', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/App.jsx', "import { controller } from './app/useBusinessSettingsController.js'\nimport { registry } from './app/surfaces/settings/policies/registry.js'\n")
  await write('src/app/useBusinessSettingsController.js', 'export const controller = {}\n')
  await write('src/app/surfaces/settings/policies/registry.js', 'export const registry = []\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.some((value) => value.includes('app-c3-legacy-owner')))
  assert.ok(violations.some((value) => value.includes('app-settings-policy')))
})


test('non-Orders consumers cannot deep import Orders internals', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/App.jsx', "import { isOrderActive } from './domains/orders/domain/orderLifecycle.js'\n")
  await write('src/domains/orders/domain/orderLifecycle.js', 'export const isOrderActive = () => true\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.some((item) => item.startsWith('orders-deep-import:')))
})

test('C4 legacy Orders owners are rejected when they reappear', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/pages/Orders.jsx', 'export default function Orders() {}\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.some((item) => item.startsWith('c4-legacy-orders-owner:')))
})

test('legacy API client cannot reintroduce Orders lifecycle exports', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/api/client.js', [
    "export const createOrder = () => {}",
    "export const refundOrder = () => {}",
  ].join('\n'))
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.includes('c4-legacy-orders-api: src/api/client.js'))
})


test('external consumers cannot deep import Table Service internals', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/App.jsx', "import Comandas from './domains/table-service/ui/Comandas.jsx'\n")
  await write('src/domains/table-service/ui/Comandas.jsx', 'export default function Comandas() {}\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.includes('table-service-deep-import: src/App.jsx -> src/domains/table-service/ui/Comandas.jsx'))
})

test('Orders may use the Table Service public entry', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/domains/orders/ui/x.js', "import { Tables } from '../../table-service/index.js'\n")
  await write('src/domains/table-service/index.js', 'export const Tables = () => null\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.equal(violations.some((item) => item.startsWith('table-service-deep-import:')), false)
  assert.equal(violations.some((item) => item.startsWith('cross-domain-internal:')), false)
})

test('Table Service cannot import Orders even through its public entry', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/domains/table-service/ui/x.js', "import { Orders } from '../../orders/index.js'\n")
  await write('src/domains/orders/index.js', 'export const Orders = () => null\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.includes('table-service-orders-import: src/domains/table-service/ui/x.js -> src/domains/orders/index.js'))
})

test('C5 legacy Table Service owners are rejected when they reappear', async (t) => {
  const { rootDir, write } = await createFixture(t)
  for (const legacyOwner of [
    'src/pages/Tables.jsx',
    'src/pages/Comandas.jsx',
    'src/components/ComandaDetail.jsx',
    'src/components/TableTransferDialog.jsx',
    'src/components/LocalTableSelector.jsx',
  ]) {
    await write(legacyOwner, 'export default function LegacyOwner() {}\n')
  }
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  for (const legacyOwner of [
    'src/pages/Tables.jsx',
    'src/pages/Comandas.jsx',
    'src/components/ComandaDetail.jsx',
    'src/components/TableTransferDialog.jsx',
    'src/components/LocalTableSelector.jsx',
  ]) {
    assert.ok(violations.includes(`c5-legacy-table-service-owner: ${legacyOwner}`))
  }
})

test('legacy API client cannot reintroduce migrated Table Service exports', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/api/client.js', [
    'export const transferTableTab = () => {}',
    'export const registerTableTabPayment = () => {}',
  ].join('\n'))
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.includes('c5-legacy-table-service-api: src/api/client.js'))
})


test('external consumers cannot deep import Finance internals', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/App.jsx', "import Finance from './domains/finance/ui/Finance.jsx'\n")
  await write('src/domains/finance/ui/Finance.jsx', 'export default function Finance() {}\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.some((item) => item.startsWith('finance-deep-import:')))
})

test('Finance cannot import Orders even through its public entry', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/domains/finance/ui/x.js', "import { Orders } from '../../orders/index.js'\n")
  await write('src/domains/orders/index.js', 'export const Orders = () => null\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.some((item) => item.startsWith('finance-orders-import:')))
})

test('Finance cannot import Table Service even through its public entry', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/domains/finance/ui/x.js', "import { Tables } from '../../table-service/index.js'\n")
  await write('src/domains/table-service/index.js', 'export const Tables = () => null\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.some((item) => item.startsWith('finance-table-service-import:')))
})

test('C6 legacy Finance owners are rejected when they reappear', async (t) => {
  const { rootDir, write } = await createFixture(t)
  for (const legacyOwner of [
    'src/pages/Finance.jsx',
    'src/pages/Receivables.jsx',
    'src/components/MovementDialog.jsx',
    'src/components/OpeningBalanceDialog.jsx',
    'src/components/PaymentPromiseDialog.jsx',
    'src/components/ReceivableDetail.jsx',
    'src/components/ReceivablesForecastDialog.jsx',
    'src/components/ReceivablesQuickPaymentDialog.jsx',
    'src/components/RegisterRefundDialog.jsx',
    'src/components/TableTabPaymentDialog.jsx',
    'src/utils/paymentMethodOptions.js',
    'src/utils/financeCategoryOptions.js',
    'src/utils/finance.js',
    'src/utils/receivables.js',
    'src/utils/paymentWorkflow.js',
  ]) await write(legacyOwner, 'export const legacy = true\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.equal(violations.filter((item) => item.startsWith('c6-legacy-finance-owner:')).length, 15)
})

test('legacy API client cannot reintroduce C6 migrated exports', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/api/client.js', 'export const registerPayment = () => {}\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.includes('c6-legacy-finance-api: src/api/client.js'))
})

test('cross-domain payment and refund workflows cannot move under domains', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/domains/orders/workflows/payments/useOrderPaymentWorkflow.js', 'export const x = 1\n')
  await write('src/domains/finance/workflows/refunds/useRefundWorkflow.js', 'export const y = 1\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.equal(violations.filter((item) => item.startsWith('c6-domain-workflow-owner:')).length, 2)
})

test('Finance and payment workflows cannot import printing internals', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/domains/finance/ui/x.js', "import { print } from '../../../printing/usePrintingManager.js'\n")
  await write('src/app/workflows/payments/order/x.js', "import { print } from '../../../../printing/qzTrayTransport.js'\n")
  await write('src/printing/usePrintingManager.js', 'export const print = () => {}\n')
  await write('src/printing/qzTrayTransport.js', 'export const print = () => {}\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.equal(violations.filter((item) => item.startsWith('c6-finance-payment-printing-import:')).length, 2)
})
