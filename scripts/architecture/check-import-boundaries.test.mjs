import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
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

test('direct qz-tray imports remain rejected outside infrastructure/qz without a migration allowance', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/printing/usePrintingManager.js', "import qz from 'qz-tray'\n")
  const violations = await findArchitectureViolations({ rootDir })
  assert.ok(violations.includes('qz-direct: src/printing/usePrintingManager.js -> qz-tray'))
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

test('test files do not turn internal domain units into production public contracts', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/ordersBehavior.test.js', "import { isOrderActive } from './domains/orders/domain/orderLifecycle.js'\n")
  await write('src/domains/orders/domain/orderLifecycle.js', 'export const isOrderActive = () => true\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.equal(violations.some((item) => item.startsWith('orders-deep-import:')), false)
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


test('C7 external consumers cannot deep import Customers internals', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/App.jsx', "import Clients from './domains/customers/ui/Clients.jsx'\n")
  await write('src/domains/customers/ui/Clients.jsx', 'export default function Clients() {}\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.includes('customers-deep-import: src/App.jsx -> src/domains/customers/ui/Clients.jsx'))
})

test('C7 Customers and Orders may only cross through the Customers public contract', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/domains/customers/ui/x.js', "import { isOrderActive } from '../../orders/domain/orderLifecycle.js'\n")
  await write('src/domains/orders/domain/orderLifecycle.js', 'export const isOrderActive = () => true\n')
  await write('src/domains/orders/ui/y.js', "import { customersApi } from '../../customers/infrastructure/customersApi.js'\n")
  await write('src/domains/customers/infrastructure/customersApi.js', 'export const customersApi = {}\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.includes('customers-orders-internal: src/domains/customers/ui/x.js -> src/domains/orders/domain/orderLifecycle.js'))
  assert.ok(violations.includes('orders-customers-internal: src/domains/orders/ui/y.js -> src/domains/customers/infrastructure/customersApi.js'))
})

test('C7 legacy Customers owners and API exports are permanently rejected', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/pages/Clients.jsx', 'export default function Clients() {}\n')
  await write('src/components/ClientDuplicateModal.jsx', 'export default function ClientDuplicateModal() {}\n')
  await write('src/api/client.js', [
    'export const createClient = () => {}',
    'export const updateClient = () => {}',
    'export const deleteClient = () => {}',
  ].join('\n'))
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.includes('c7-legacy-customers-owner: src/pages/Clients.jsx'))
  assert.ok(violations.includes('c7-legacy-customers-owner: src/components/ClientDuplicateModal.jsx'))
  assert.ok(violations.includes('c7-legacy-customers-api: src/api/client.js'))
})

test('C7 rejects customer ownership and client collection mutation returning to App', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/App.jsx', [
    'const handleAddClient = () => {}',
    'const duplicateClientDialog = {}',
    "updateCollection('clients', () => [])",
  ].join('\n'))
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.includes('c7-app-customer-owner: src/App.jsx'))
  assert.ok(violations.includes('c7-customer-update-collection: src/App.jsx'))
})

test('C7 rejects updateCollection clients inside Customers', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/domains/customers/application/x.js', "updateCollection('clients', () => [])\n")
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.includes('c7-customer-update-collection: src/domains/customers/application/x.js'))
})

test('C7 keeps frontend duplicate/name rules out of shared while allowing permanent phone primitives', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('shared/clientIdentity.js', [
    'export const normalizeClientPhone = (value) => value',
    'export const formatClientPhone = (value) => value',
    'export const normalizeClientName = (value) => value',
    'export const findClientDuplicates = () => ({})',
  ].join('\n'))
  let violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.includes('c7-shared-customer-duplicate: shared/clientIdentity.js'))

  await write('shared/clientIdentity.js', [
    'export const normalizeClientPhone = (value) => value',
    'export const formatClientPhone = (value) => value',
  ].join('\n'))
  violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.equal(violations.some((item) => item.startsWith('c7-shared-customer-duplicate:')), false)
})

test('domain layer cannot import same-domain infrastructure', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/domains/customers/domain/rules.js', "import { api } from '../infrastructure/customersApi.js'\n")
  await write('src/domains/customers/infrastructure/customersApi.js', 'export const api = {}\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.includes('domain-infrastructure: src/domains/customers/domain/rules.js -> src/domains/customers/infrastructure/customersApi.js'))
})


test('C8 external consumers cannot deep import Catalog internals', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/App.jsx', "import Products from './domains/catalog/ui/Products.jsx'\n")
  await write('src/domains/orders/ui/x.js', "import { catalogApi } from '../../catalog/infrastructure/catalogApi.js'\n")
  await write('src/domains/catalog/ui/Products.jsx', 'export default function Products() {}\n')
  await write('src/domains/catalog/infrastructure/catalogApi.js', 'export const catalogApi = {}\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.includes('catalog-deep-import: src/App.jsx -> src/domains/catalog/ui/Products.jsx'))
  assert.ok(violations.includes('catalog-deep-import: src/domains/orders/ui/x.js -> src/domains/catalog/infrastructure/catalogApi.js'))
})

test('C8 Catalog cannot depend on Orders, Finance, Table Service, Printing or QZ', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/domains/catalog/application/x.js', [
    "import { Orders } from '../../orders/index.js'",
    "import { Finance } from '../../finance/index.js'",
    "import { Tables } from '../../table-service/index.js'",
    "import { print } from '../../../printing/runtime.js'",
    "import { qz } from '../../../infrastructure/qz/runtime.js'",
    "import tray from 'qz-tray'",
  ].join('\n'))
  await write('src/domains/orders/index.js', 'export const Orders = {}\n')
  await write('src/domains/finance/index.js', 'export const Finance = {}\n')
  await write('src/domains/table-service/index.js', 'export const Tables = {}\n')
  await write('src/printing/runtime.js', 'export const print = () => {}\n')
  await write('src/infrastructure/qz/runtime.js', 'export const qz = {}\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.includes('catalog-orders-import: src/domains/catalog/application/x.js -> src/domains/orders/index.js'))
  assert.ok(violations.includes('catalog-finance-import: src/domains/catalog/application/x.js -> src/domains/finance/index.js'))
  assert.ok(violations.includes('catalog-table-service-import: src/domains/catalog/application/x.js -> src/domains/table-service/index.js'))
  assert.ok(violations.includes('catalog-printing-import: src/domains/catalog/application/x.js -> src/printing/runtime.js'))
  assert.ok(violations.includes('catalog-qz-import: src/domains/catalog/application/x.js -> src/infrastructure/qz/runtime.js'))
  assert.ok(violations.includes('catalog-qz-import: src/domains/catalog/application/x.js -> qz-tray'))
})

test('C8 legacy Catalog owners and product CRUD exports are permanently rejected', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/pages/Products.jsx', 'export default function Products() {}\n')
  await write('src/components/ProductForm.jsx', 'export default function ProductForm() {}\n')
  await write('src/api/client.js', [
    'export function createProduct() {}',
    'export const updateProduct = () => {}',
    "export { deleteProduct as removeLegacyProduct } from './legacyProducts.js'",
  ].join('\n'))
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.includes('c8-legacy-catalog-owner: src/pages/Products.jsx'))
  assert.ok(violations.includes('c8-legacy-catalog-owner: src/components/ProductForm.jsx'))
  assert.ok(violations.includes('c8-legacy-catalog-api: src/api/client.js'))
})

test('C8 rejects product ownership returning to App and updateCollection returning to production', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/App.jsx', [
    'const editingProductId = null',
    'const handleAddProduct = () => {}',
    'const useCatalogCommands = () => {}',
  ].join('\n'))
  await write('src/app/runtime/data/useOperationalDataRuntime.js', [
    'export const updateCollection = () => {}',
    "updateCollection('products', () => [])",
  ].join('\n'))
  await write('src/app/runtime/data/useOperationalDataRuntime.test.js', "assert.doesNotMatch(source, /\\bupdateCollection\\b/)\n")
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.includes('c8-app-catalog-owner: src/App.jsx'))
  assert.ok(violations.includes('c8-update-collection: src/app/runtime/data/useOperationalDataRuntime.js'))
  assert.equal(violations.some((value) => value.includes('useOperationalDataRuntime.test.js') && value.startsWith('c8-update-collection:')), false)
})

test('C8 keeps frontend consumers behind Catalog and frontend metadata out of shared', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/domains/orders/domain/x.js', "import { PRODUCT_CATEGORIES } from '../../../../shared/productCatalog.js'\n")
  await write('shared/productCatalog.js', [
    "export const PRODUCT_CATEGORIES = ['Outros']",
    "export const CATEGORY_ICON_NAMES = { Outros: 'package' }",
    'export const categoryForUi = () => "Outros"',
  ].join('\n'))
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.includes('catalog-shared-bypass: src/domains/orders/domain/x.js -> shared/productCatalog.js'))
  assert.ok(violations.includes('c8-shared-catalog-metadata: shared/productCatalog.js'))
})

test('C8 Catalog domain remains free of React, UI, infrastructure and browser APIs', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/domains/catalog/domain/rules.js', [
    "import React from 'react'",
    "import { api } from '../infrastructure/catalogApi.js'",
    "import ProductForm from '../ui/ProductForm.jsx'",
    'export const browserRead = () => window.localStorage.getItem("x")',
    'export const remoteRead = () => fetch("/api/products")',
  ].join('\n'))
  await write('src/domains/catalog/infrastructure/catalogApi.js', 'export const api = {}\n')
  await write('src/domains/catalog/ui/ProductForm.jsx', 'export default function ProductForm() {}\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.some((value) => value.startsWith('domain-react: src/domains/catalog/domain/rules.js')))
  assert.ok(violations.some((value) => value.startsWith('domain-infrastructure: src/domains/catalog/domain/rules.js')))
  assert.ok(violations.some((value) => value.startsWith('domain-ui: src/domains/catalog/domain/rules.js')))
  assert.ok(violations.includes('catalog-domain-browser: src/domains/catalog/domain/rules.js'))
})

test('C8 allows Orders through Catalog public entry plus Catalog internal and shared contracts', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/domains/orders/domain/x.js', "import { formatProductPresentation } from '../../catalog/index.js'\n")
  await write('src/domains/catalog/index.js', "export { formatProductPresentation } from '../../../shared/productCatalog.js'\n")
  await write('src/domains/catalog/application/x.js', "import { categoryForUi } from '../domain/catalogPresentation.js'\n")
  await write('src/domains/catalog/domain/catalogPresentation.js', "import { PRODUCT_CATEGORIES } from '../../../../shared/productCatalog.js'\nexport const categoryForUi = () => PRODUCT_CATEGORIES[0]\n")
  await write('shared/productCatalog.js', "export const PRODUCT_CATEGORIES = ['Outros']\nexport const formatProductPresentation = () => 'Unidade'\n")
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.equal(violations.some((value) => /^(?:catalog-|c8-)/.test(value)), false)
})


test('C9 App cannot deep import Printing internals', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/App.jsx', "import { x } from './domains/printing/application/usePrintingManager.js'\n")
  await write('src/domains/printing/application/usePrintingManager.js', 'export const x = 1\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.includes('c9-printing-deep-import: src/App.jsx -> src/domains/printing/application/usePrintingManager.js'))
})

test('C9 Settings cannot deep import Printing internals', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/app/surfaces/settings/SettingsSurface.jsx', "import { x } from '../../../domains/printing/ui/PrintingSettingsContent.jsx'\n")
  await write('src/domains/printing/ui/PrintingSettingsContent.jsx', 'export const x = 1\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.includes('c9-printing-deep-import: src/app/surfaces/settings/SettingsSurface.jsx -> src/domains/printing/ui/PrintingSettingsContent.jsx'))
})

test('C9 Printing domain remains React-free', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/domains/printing/domain/rules.js', "import React from 'react'\n")
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.includes('c9-printing-domain-react: src/domains/printing/domain/rules.js -> react'))
})

test('C9 Printing domain cannot import qz-tray', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/domains/printing/domain/rules.js', "import qz from 'qz-tray'\n")
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.includes('c9-printing-domain-qz: src/domains/printing/domain/rules.js -> qz-tray'))
})

test('C9 Printing domain remains browser and fetch free', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/domains/printing/domain/rules.js', "export const x = () => globalThis.localStorage.getItem('x') || fetch('/x')\n")
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.includes('c9-printing-domain-browser: src/domains/printing/domain/rules.js'))
})

test('C10 closes migration scaffolding and keeps final facade removals protected', async (t) => {
  const repositoryRoot = process.cwd()
  const architectureDir = path.join(repositoryRoot, 'scripts', 'architecture')
  const checker = readFileSync(path.join(architectureDir, 'check-import-boundaries.mjs'), 'utf8')

  assert.equal(existsSync(path.join(architectureDir, 'legacy-import-allowlist.json')), false)
  assert.equal(readdirSync(architectureDir).some((name) => /allowlist/i.test(name)), false)
  assert.doesNotMatch(checker, /allowlist/i)

  const { rootDir, write } = await createFixture(t)
  await write('src/api/client.js', 'export const apiRequest = () => {}\n')
  await write('src/api/effectiveConfigClient.js', 'export const getEffectiveConfig = () => {}\n')
  await write('src/app/runtime/data/useOperationalDataRuntime.js', [
    'export const legacyBridges = {}',
    'export const capturePaymentOwners = () => {}',
    'export const settlePaymentOwners = () => {}',
    'export const updateCollection = () => {}',
  ].join('\n'))

  const violations = await findArchitectureViolations({ rootDir })
  assert.ok(violations.includes('c10-legacy-api-facade: src/api/client.js'))
  assert.ok(violations.includes('c10-legacy-api-facade: src/api/effectiveConfigClient.js'))
  assert.ok(violations.includes('c10-legacy-payment-receipt-bridge: src/app/runtime/data/useOperationalDataRuntime.js'))
  assert.ok(violations.includes('c10-legacy-update-collection: src/app/runtime/data/useOperationalDataRuntime.js'))
})

test('C9 Printing cannot deep import another domain internal', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/domains/printing/application/x.js', "import { y } from '../../orders/domain/orderLifecycle.js'\n")
  await write('src/domains/orders/domain/orderLifecycle.js', 'export const y = 1\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.includes('c9-printing-cross-domain-internal: src/domains/printing/application/x.js -> src/domains/orders/domain/orderLifecycle.js'))
})

test('C9 qz-tray imports outside infrastructure/qz remain rejected', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/app/qzOwner.js', "import qz from 'qz-tray'\n")
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.includes('qz-direct: src/app/qzOwner.js -> qz-tray'))
})

test('C9 QZ infrastructure cannot depend on Printing application internals', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/infrastructure/qz/qzTransport.js', "import { x } from '../../domains/printing/application/usePrintingManager.js'\n")
  await write('src/domains/printing/application/usePrintingManager.js', 'export const x = 1\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.includes('c9-qz-printing-internal: src/infrastructure/qz/qzTransport.js -> src/domains/printing/application/usePrintingManager.js'))
})

test('C9 legacy src/printing production owner cannot return', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/printing/runtime.js', 'export const legacy = true\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.includes('c9-legacy-printing-owner: src/printing/runtime.js'))
})

test('C9 legacy API client cannot reintroduce Printing exports', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/api/client.js', [
    'export const getPrintJobs = () => {}',
    'export { signQzPayload } from "./legacyPrinting.js"',
  ].join('\n'))
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.includes('c9-legacy-printing-api: src/api/client.js'))
})

test('C9 App cannot regain second-copy recovery or QZ ownership', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/App.jsx', [
    'const secondCopyPromptJobId = null',
    'const recoveryDialogMode = null',
    'const canPresentSecondCopyPrompt = () => true',
    'const qzTransport = {}',
  ].join('\n'))
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.includes('c9-app-printing-owner: src/App.jsx'))
})

test('C9 App and Settings may consume only the Printing public entry', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/App.jsx', "import { usePrintingManager } from './domains/printing/index.js'\n")
  await write('src/app/surfaces/settings/SettingsSurface.jsx', "import { PrintingSettingsContent } from '../../../domains/printing/index.js'\n")
  await write('src/domains/printing/index.js', 'export const usePrintingManager = () => {}\nexport const PrintingSettingsContent = () => null\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.equal(violations.some((value) => value.startsWith('c9-printing-deep-import:')), false)
})

test('C9 Printing may consume permanent shared print contracts', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/domains/printing/domain/rules.js', "import { x } from '../../../../shared/printQueue.js'\n")
  await write('shared/printQueue.js', 'export const x = 1\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.equal(violations.some((value) => value.startsWith('c9-printing-')), false)
})

test('C9 Printing application may consume first-class QZ infrastructure modules', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/domains/printing/application/manager.js', "import { createQzTransport } from '../../../infrastructure/qz/qzTransport.js'\n")
  await write('src/infrastructure/qz/qzTransport.js', 'export const createQzTransport = () => ({})\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.equal(violations.some((value) => value.startsWith('c9-printing-qz-infra:')), false)
  assert.equal(violations.some((value) => value.startsWith('c9-qz-printing-internal:')), false)
})

test('C10 final generic guards reject legacy roots, App legacy imports, shared domain imports, generic domain impurity, external deep imports, QZ escapes, and public-entry cycles', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/api/runtime.js', 'export const legacy = true\n')
  await write('src/pages/runtime.jsx', 'export default null\n')
  await write('src/printing/runtime.js', 'export const legacy = true\n')
  await write('src/components/runtime.jsx', 'export default null\n')
  await write('src/hooks/runtime.js', 'export const legacy = true\n')
  await write('src/utils/runtime.js', 'export const legacy = true\n')
  await write('src/App.jsx', "import { legacy } from './utils/runtime.js'\n")
  await write('src/shared/ui/invalid.jsx', "import { Orders } from '../../domains/orders/index.js'\n")
  await write('src/domains/orders/domain/invalid.js', [
    "import React from 'react'",
    "import { api } from '../infrastructure/ordersApi.js'",
    "import Panel from '../ui/Panel.jsx'",
    "import qz from 'qz-tray'",
    'export const invalid = () => window.localStorage.getItem("x") || document.title || sessionStorage.getItem("x") || navigator.language || fetch("/x")',
  ].join('\n'))
  await write('src/domains/orders/infrastructure/ordersApi.js', 'export const api = {}\n')
  await write('src/domains/orders/ui/Panel.jsx', 'export default null\n')
  await write('src/domains/catalog/domain/internal.js', 'export const internal = true\n')
  await write('src/app/deep-import.js', "import { internal } from '../domains/catalog/domain/internal.js'\n")
  await write('src/app/qz-owner.js', "import qz from 'qz-tray'\n")
  await write('src/domains/orders/application/a.js', "import { b } from '../../catalog/index.js'\n")
  await write('src/domains/catalog/application/b.js', "import { a } from '../../orders/index.js'\n")
  await write('src/domains/orders/index.js', 'export const a = true\n')
  await write('src/domains/catalog/index.js', 'export const b = true\n')

  const violations = await findArchitectureViolations({ rootDir })
  for (const root of ['api', 'pages', 'printing', 'components', 'hooks', 'utils']) {
    assert.ok(violations.includes(`legacy-production-root: src/${root}/${root === 'pages' || root === 'components' ? 'runtime.jsx' : 'runtime.js'}`))
  }
  assert.ok(violations.includes('app-legacy-root-import: src/App.jsx -> src/utils/runtime.js'))
  assert.ok(violations.includes('shared-domain: src/shared/ui/invalid.jsx -> src/domains/orders/index.js'))
  assert.ok(violations.some((value) => value.startsWith('domain-react: src/domains/orders/domain/invalid.js')))
  assert.ok(violations.includes('domain-infrastructure: src/domains/orders/domain/invalid.js -> src/domains/orders/infrastructure/ordersApi.js'))
  assert.ok(violations.includes('domain-ui: src/domains/orders/domain/invalid.js -> src/domains/orders/ui/Panel.jsx'))
  assert.ok(violations.some((value) => value.startsWith('domain-qz: src/domains/orders/domain/invalid.js')))
  assert.ok(violations.includes('domain-browser: src/domains/orders/domain/invalid.js'))
  assert.ok(violations.includes('domain-deep-import: src/app/deep-import.js -> src/domains/catalog/domain/internal.js'))
  assert.ok(violations.includes('qz-direct: src/app/qz-owner.js -> qz-tray'))
  assert.ok(violations.includes('domain-cycle: catalog -> orders -> catalog'))
})

test('C10 final generic guards allow production tests, public domain entries, shared React UI/hooks, pure shared utils, and QZ infrastructure', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/api/runtime.test.js', 'export const testOnly = true\n')
  await write('src/App.jsx', "import { Catalog } from './domains/catalog/index.js'\n")
  await write('src/domains/orders/application/catalog.js', "import { Catalog } from '../../catalog/index.js'\n")
  await write('src/domains/orders/index.js', 'export const Orders = true\n')
  await write('src/domains/catalog/index.js', 'export const Catalog = true\n')
  await write('src/shared/ui/Button.jsx', "import React from 'react'\nexport default () => React.createElement('button')\n")
  await write('src/shared/hooks/useValue.js', "import { useState } from 'react'\nexport const useValue = () => useState(0)\n")
  await write('src/shared/utils/format.js', 'export const format = (value) => String(value).trim()\n')
  await write('src/infrastructure/qz/transport.js', "import qz from 'qz-tray'\nexport { qz }\n")

  const violations = await findArchitectureViolations({ rootDir })
  assert.deepEqual(violations, [])
})

test('split-payment guards reject obsolete scalar writers, owners, storage strings and Orders workflow imports', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/app/workflows/payments/paymentApi.js', `
    export const paymentApi = {
      registerOrderPayment: (id, method) => json('POST', { method }),
      registerTableTabPayment: (id, method) => json('POST', { method }),
    }
  `)
  await write('src/domains/orders/domain/orderCart.js', 'export const buildOrderPayload = () => ({ paymentMethod: "Pix" })\n')
  await write('src/domains/orders/ui/invalid.jsx', "import Editor from '../../../app/workflows/payments/PaymentCompositionEditor.jsx'\nexport default Editor\n")
  await write('src/app/workflows/payments/PaymentCompositionEditor.jsx', 'export default null\n')
  await write('src/app/synthetic.js', 'export const stored = "Dinheiro + Pix"\n')
  await write('worker/repositories.js', `
    export const registerOrderPayment = () => {}
    export const registerTableTabPayment = () => {}
    const sql = 'INSERT INTO payments (id, method) VALUES (?, ?)'
  `)

  const violations = await findArchitectureViolations({ rootDir })
  for (const code of [
    'split-payment-api-order-method',
    'split-payment-api-table-method',
    'split-payment-checkout-scalar',
    'split-payment-repository-owner',
    'split-payment-method-write',
    'split-payment-synthetic-storage',
    'orders-payment-workflow-import',
  ]) assert.ok(violations.some((value) => value.startsWith(code)), `missing ${code}`)
})
