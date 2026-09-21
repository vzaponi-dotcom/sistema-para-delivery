import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs'])
const C3_LEGACY_SETTINGS_OWNERS = new Set([
  'src/pages/Settings.jsx',
  'src/pages/SettingsHome.jsx',
  'src/pages/OperationSettings.jsx',
  'src/pages/PaymentSettings.jsx',
  'src/pages/CancellationSettings.jsx',
  'src/pages/FinanceCategorySettings.jsx',
  'src/pages/paymentSettingsModel.js',
  'src/app/settingsState.js',
  'src/app/settingsConflict.js',
  'src/app/settingsConflictPresentation.js',
  'src/app/settingsPendingStorage.js',
  'src/app/useBusinessSettingsController.js',
  'src/app/usePrintingSettingsController.js',
  'src/app/navigation/settingsDraftGuard.js',
  'src/api/settingsClient.js',
  'src/components/SettingsControls.jsx',
  'src/components/SettingsConflictReview.jsx',
  'src/components/SettingsEditorShell.jsx',
  'src/components/SettingsItemDialog.jsx',
  'src/components/SettingsItemList.jsx',
])
const C5_LEGACY_TABLE_SERVICE_OWNERS = new Set([
  'src/pages/Tables.jsx',
  'src/pages/Comandas.jsx',
  'src/components/ComandaDetail.jsx',
  'src/components/TableTransferDialog.jsx',
  'src/components/LocalTableSelector.jsx',
])
const C7_LEGACY_CUSTOMERS_OWNERS = new Set([
  'src/pages/Clients.jsx',
  'src/components/ClientDuplicateModal.jsx',
])
const C7_APP_CUSTOMER_OWNER_PATTERNS = [
  /\bnewClient\b/,
  /\beditingClientId\b/,
  /\bshowClientForm\b/,
  /\bduplicateClientDialog\b/,
  /\bvalidateClientIdentity\b/,
  /\bresetClientForm\b/,
  /\bopenNewClient\b/,
  /\bhandleEditClient\b/,
  /\bclientPayload\b/,
  /\bpersistNewClient\b/,
  /\bpersistClientUpdate\b/,
  /\bhandleAddClient\b/,
  /\bhandleSaveClient\b/,
  /\bhandleUseExistingClient\b/,
  /\bhandleConfirmDuplicateClient\b/,
  /\bhandleDeleteClient\b/,
  /\bhandleCancelClientEdit\b/,
  /\buseCustomerEditor\b/,
  /\buseCustomerCommands\b/,
  /\bfilterAndSortClients\b/,
  /\bfindClientDuplicates\b/,
  /\bClientDuplicateModal\b/,
  /\bCustomerEditorDialog\b/,
]
const C7_CLIENT_COLLECTION_MUTATION_PATTERN = /updateCollection\s*\(\s*['"]clients['"]/
const C7_SHARED_DUPLICATE_PATTERN = /\b(?:normalizeClientName|findClientDuplicates)\b/
const C8_LEGACY_CATALOG_OWNERS = new Set([
  'src/pages/Products.jsx',
  'src/components/ProductForm.jsx',
])
const C8_APP_CATALOG_OWNER_PATTERNS = [
  /\beditingProductId\b/,
  /\bshowProductForm\b/,
  /\bnewProduct\b/,
  /\bemptyProduct\b/,
  /\bproductPayload\b/,
  /\bhandleAddProduct\b/,
  /\bhandleEditProduct\b/,
  /\bhandleDeleteProduct\b/,
  /\bhandleCancelProductEdit\b/,
  /\bProductEditorDialog\b/,
  /\bProductForm\b/,
  /\buseProductEditor\b/,
  /\buseCatalogCommands\b/,
]
const C8_PRODUCT_CRUD_EXPORTS = new Set(['createProduct', 'updateProduct', 'deleteProduct'])
const C8_UPDATE_COLLECTION_PATTERN = /\bupdateCollection\b/
const C8_SHARED_METADATA_PATTERN = /\b(?:CATEGORY_ICON_NAMES|PRODUCT_CATEGORY_OPTIONS|categoryForUi|suggestPresentationType|DEFAULT_PRESENTATION)\b/
const C8_DOMAIN_BROWSER_PATTERN = /\b(?:window|document|localStorage|sessionStorage|navigator)\b|\bfetch\s*\(/
const C10_LEGACY_API_FACADES = new Set([
  'src/api/client.js',
  'src/api/effectiveConfigClient.js',
])
const C10_RUNTIME_LEGACY_BRIDGE_PATTERN = /\b(?:legacyBridges|capturePaymentOwners|settlePaymentOwners)\b/
const C10_LEGACY_PRODUCTION_ROOTS = ['api', 'pages', 'printing', 'components', 'hooks', 'utils']
const C10_DOMAIN_BROWSER_PATTERN = /\b(?:window|localStorage|sessionStorage|navigator)\b|\bfetch\s*\(/

const C9_LEGACY_PRINTING_OWNERS = new Set([
  'src/pages/PrintQueue.jsx',
  'src/pages/printQueueDetails.js',
  'src/pages/printQueueFilters.js',
  'src/pages/printQueueQuery.js',
  'src/pages/printQueueSummary.js',
  'src/components/PrintingSettings.jsx',
  'src/components/PrintingSettingsContent.jsx',
])
const C9_PRINTING_API_EXPORTS = new Set([
  'getTableTabPrintDocument',
  'createManualTableTabPrintJob',
  'getPrintSettings',
  'savePrintSettings',
  'getPrintStations',
  'upsertPrintStation',
  'heartbeatPrintStation',
  'makePrimaryPrintStation',
  'getPrintJobs',
  'getPrintQueueSummary',
  'createPrintAttempt',
  'markPrintAttemptSubmitting',
  'recordPrintAttemptEvent',
  'resolvePrintOutcome',
  'setPrintStationRecovery',
  'claimNextRecoveryPrintJob',
  'discardPendingPrintJobs',
  'createManualPrintJob',
  'createTestPrintJob',
  'claimNextPrintJob',
  'claimPrintJob',
  'acknowledgeSecondCopyPrompt',
  'requestSecondCopy',
  'skipSecondCopy',
  'completePrintJob',
  'failPrintJob',
  'retryPrintJob',
  'discardPrintJob',
  'prioritizePrintJob',
  'forcePrintJob',
  'reprintPrintJob',
  'getOrderPrintDocument',
  'getQzCertificate',
  'signQzPayload',
])
const C9_PRINTING_PEER_DOMAINS = new Set(['orders', 'finance', 'table-service', 'customers', 'catalog'])
const C9_APP_PRINTING_OWNER_PATTERNS = [
  /\bsecondCopyPromptJobId\b/,
  /\boriginSecondCopyPromptJobId\b/,
  /\brecoveryDialogMode\b/,
  /\bpausedRecoverySecondCopyJobIdRef\b/,
  /\brecoveryPromptSeenRef\b/,
  /\bpreviousRecoveryStateRef\b/,
  /\bcanPresentSecondCopyPrompt\b/,
  /\bcanKeepSecondCopyPromptOpen\b/,
  /\backnowledgeAndOpenSecondCopyPrompt\b/,
  /\bfindOriginSecondCopyPrompt\b/,
  /\breadOriginOrderIds\b/,
  /\brememberOriginOrderId\b/,
  /\bqzTransport\b/,
  /\bcreateQzTransport\b/,
  /\bgetQzCertificate\b/,
  /\bsignQzPayload\b/,
  /['"]qz-tray['"]/,
]
const C9_PRINTING_DOMAIN_BROWSER_PATTERN = /\bglobalThis\.(?:window|document|localStorage|sessionStorage|navigator)\b|\b(?:window|localStorage|sessionStorage|navigator)\b|\bfetch\s*\(/

const C6_LEGACY_FINANCE_OWNERS = new Set([
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
  'src/app/surfaces/settings/PaymentSettings.jsx',
  'src/app/surfaces/settings/FinanceCategorySettings.jsx',
  'src/app/surfaces/settings/paymentSettingsModel.js',
  'src/app/surfaces/settings/policies/paymentMethodsPolicy.js',
  'src/app/surfaces/settings/policies/financeCategoriesPolicy.js',
  'src/utils/paymentMethodOptions.js',
  'src/utils/financeCategoryOptions.js',
  'src/utils/finance.js',
  'src/utils/receivables.js',
  'src/utils/paymentWorkflow.js',
])
const C4_LEGACY_ORDERS_OWNERS = new Set([
  'src/pages/NewOrder.jsx',
  'src/pages/NewOrderRoute.jsx',
  'src/pages/OrderHistory.jsx',
  'src/pages/Orders.jsx',
  'src/hooks/useKitchenClock.js',
  'src/utils/cancellationReasonOptions.js',
  'src/utils/kitchenClock.js',
  'src/utils/kitchenQueue.js',
  'src/utils/kitchenTicket.js',
  'src/utils/newOrderStepFlow.js',
  'src/utils/orderCart.js',
  'src/utils/orderLifecycle.js',
  'src/utils/orderPaymentEligibility.js',
  'src/utils/orderRealtime.js',
  'src/utils/orderTypeOptions.js',
  'src/utils/orderWorkflow.js',
  'src/components/CancelOrderDialog.jsx',
  'src/components/KitchenTicket.jsx',
  'src/components/KitchenTicketNotes.jsx',
  'src/components/NewOrderCartSummary.jsx',
  'src/components/NewOrderCustomerStep.jsx',
  'src/components/NewOrderProductsStep.jsx',
  'src/components/NewOrderReviewStep.jsx',
  'src/components/NewOrderStepIndicator.jsx',
  'src/components/OperationalHistoryAnalysis.jsx',
  'src/components/OrderCart.jsx',
  'src/components/OrderCheckoutSummary.jsx',
  'src/components/OrderDetail.jsx',
  'src/components/OrderDetailTiming.js',
  'src/components/OrderDetailTiming.jsx',
  'src/components/OrderProductCatalog.jsx',
])
const IMPORT_PATTERNS = [
  /\bimport\s+(?:[^'"()]*?\s+from\s+)?['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
]

const posix = (value) => value.split(path.sep).join('/')
const repoRelative = (rootDir, absolutePath) => posix(path.relative(rootDir, absolutePath))

const listSourceFiles = async (directory) => {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
  const files = []
  for (const entry of entries) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await listSourceFiles(target))
    else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) files.push(target)
  }
  return files
}

const importSpecifiers = (source) => {
  const values = []
  for (const pattern of IMPORT_PATTERNS) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(source))) values.push(match[1])
  }
  return values
}

const resolveSpecifier = (rootDir, fromAbsolutePath, specifier) => {
  if (!specifier.startsWith('.')) return null
  return repoRelative(rootDir, path.resolve(path.dirname(fromAbsolutePath), specifier))
}

export const collectImportEdges = async (rootDir) => {
  const files = await listSourceFiles(path.join(rootDir, 'src'))
  const edges = []
  for (const absolutePath of files) {
    const source = await readFile(absolutePath, 'utf8')
    for (const specifier of importSpecifiers(source)) {
      edges.push({
        from: repoRelative(rootDir, absolutePath),
        specifier,
        resolvedPath: resolveSpecifier(rootDir, absolutePath, specifier),
      })
    }
  }
  return edges
}

const domainOf = (relativePath) => relativePath?.match(/^src\/domains\/([^/]+)\//)?.[1] ?? null
const isDomainLayer = (relativePath) => /^src\/domains\/[^/]+\/domain\//.test(relativePath)
const isTestFile = (relativePath) => /\.(?:test|spec)\.(?:js|jsx|mjs)$/.test(relativePath)
const isReactSpecifier = (specifier) => specifier === 'react'
  || specifier.startsWith('react/')
  || specifier === 'react-dom'
  || specifier.startsWith('react-dom/')

const usesDomainBrowserApi = (source) => C10_DOMAIN_BROWSER_PATTERN.test(source)
  || (/\bdocument\s*\./.test(source) && !/[({,]\s*document\s*(?:[,)=])/.test(source))

const findDomainCycle = (domainEdges) => {
  const visited = new Set()
  const active = []
  const activeIndex = new Map()
  const visit = (domain) => {
    visited.add(domain)
    activeIndex.set(domain, active.length)
    active.push(domain)
    for (const target of [...(domainEdges.get(domain) ?? [])].sort()) {
      if (activeIndex.has(target)) return [...active.slice(activeIndex.get(target)), target]
      if (!visited.has(target)) {
        const cycle = visit(target)
        if (cycle) return cycle
      }
    }
    active.pop()
    activeIndex.delete(domain)
    return null
  }
  for (const domain of [...domainEdges.keys()].sort()) {
    if (!visited.has(domain)) {
      const cycle = visit(domain)
      if (cycle) return cycle
    }
  }
  return null
}

const exportMentionsAny = (source, names) => {
  for (const match of source.matchAll(/\bexport\s+(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)) {
    if (names.has(match[1])) return true
  }
  for (const match of source.matchAll(/\bexport\s*\{([^}]+)\}(?:\s+from\s+['"][^'"]+['"])?/gs)) {
    for (const rawSpecifier of match[1].split(',')) {
      const specifier = rawSpecifier.trim().replace(/\s+/g, ' ')
      const named = specifier.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/)
      if (named && (names.has(named[1]) || names.has(named[2]))) return true
    }
  }
  return false
}

export const findArchitectureViolations = async ({ rootDir }) => {
  const edges = await collectImportEdges(rootDir)
  const sourcePaths = new Set((await listSourceFiles(path.join(rootDir, 'src'))).map((file) => repoRelative(rootDir, file)))
  const violations = []

  const readOptional = async (relativePath) => {
    try {
      return await readFile(path.join(rootDir, relativePath), 'utf8')
    } catch (error) {
      if (error?.code === 'ENOENT') return ''
      throw error
    }
  }

  const paymentApiSource = await readOptional('src/app/workflows/payments/paymentApi.js')
  if (/registerOrderPayment\s*:[\s\S]{0,300}?json\s*\(\s*['"]POST['"]\s*,\s*\{\s*method\b/.test(paymentApiSource)) {
    violations.push('split-payment-api-order-method: src/app/workflows/payments/paymentApi.js')
  }
  if (/registerTableTabPayment\s*:[\s\S]{0,300}?json\s*\(\s*['"]POST['"]\s*,\s*\{\s*method\b/.test(paymentApiSource)) {
    violations.push('split-payment-api-table-method: src/app/workflows/payments/paymentApi.js')
  }

  const orderCartSource = await readOptional('src/domains/orders/domain/orderCart.js')
  if (/\bpaymentMethod\s*:|payload\.paymentMethod\s*=/.test(orderCartSource)) {
    violations.push('split-payment-checkout-scalar: src/domains/orders/domain/orderCart.js')
  }

  const paymentWriterPaths = ['worker/repositories.js', 'worker/paymentRepository.js']
  for (const writerPath of paymentWriterPaths) {
    const source = await readOptional(writerPath)
    if (writerPath === 'worker/repositories.js'
      && exportMentionsAny(source, new Set(['registerOrderPayment', 'registerTableTabPayment']))) {
      violations.push(`split-payment-repository-owner: ${writerPath}`)
    }
    for (const match of source.matchAll(/INSERT\s+INTO\s+payments\s*\(([^)]*)\)\s*VALUES\s*\(([^)]*)\)/gi)) {
      const columns = match[1].split(',').map((value) => value.trim().toLowerCase())
      const values = match[2].split(',').map((value) => value.trim().toUpperCase())
      const methodIndex = columns.indexOf('method')
      if (methodIndex >= 0 && values[methodIndex] !== 'NULL') {
        violations.push(`split-payment-method-write: ${writerPath}`)
      }
    }
  }

  const productionSources = [
    ...await listSourceFiles(path.join(rootDir, 'src')),
    ...await listSourceFiles(path.join(rootDir, 'worker')),
  ]
  for (const absolutePath of productionSources) {
    const relativePath = repoRelative(rootDir, absolutePath)
    if (isTestFile(relativePath)) continue
    const source = await readFile(absolutePath, 'utf8')
    if (/Dinheiro\s*\+\s*Pix|Múltiplas formas/i.test(source)) {
      violations.push(`split-payment-synthetic-storage: ${relativePath}`)
    }
  }

  for (const legacyFacade of C10_LEGACY_API_FACADES) {
    if (sourcePaths.has(legacyFacade)) violations.push(`c10-legacy-api-facade: ${legacyFacade}`)
  }

  for (const legacyOwner of C3_LEGACY_SETTINGS_OWNERS) {
    if (sourcePaths.has(legacyOwner)) violations.push(`c3-legacy-owner: ${legacyOwner}`)
  }

  for (const legacyOwner of C4_LEGACY_ORDERS_OWNERS) {
    if (sourcePaths.has(legacyOwner)) violations.push(`c4-legacy-orders-owner: ${legacyOwner}`)
  }

  for (const legacyOwner of C5_LEGACY_TABLE_SERVICE_OWNERS) {
    if (sourcePaths.has(legacyOwner)) violations.push(`c5-legacy-table-service-owner: ${legacyOwner}`)
  }
  for (const legacyOwner of C6_LEGACY_FINANCE_OWNERS) {
    if (sourcePaths.has(legacyOwner)) violations.push(`c6-legacy-finance-owner: ${legacyOwner}`)
  }

  for (const legacyOwner of C7_LEGACY_CUSTOMERS_OWNERS) {
    if (sourcePaths.has(legacyOwner)) violations.push(`c7-legacy-customers-owner: ${legacyOwner}`)
  }

  for (const legacyOwner of C8_LEGACY_CATALOG_OWNERS) {
    if (sourcePaths.has(legacyOwner)) violations.push(`c8-legacy-catalog-owner: ${legacyOwner}`)
  }

  for (const legacyOwner of C9_LEGACY_PRINTING_OWNERS) {
    if (sourcePaths.has(legacyOwner)) violations.push(`c9-legacy-printing-owner: ${legacyOwner}`)
  }
  for (const sourcePath of sourcePaths) {
    if (!isTestFile(sourcePath) && C10_LEGACY_PRODUCTION_ROOTS.some((root) => sourcePath.startsWith(`src/${root}/`))) {
      violations.push(`legacy-production-root: ${sourcePath}`)
    }
    if (sourcePath.startsWith('src/printing/') && !isTestFile(sourcePath)) {
      violations.push(`c9-legacy-printing-owner: ${sourcePath}`)
    }
  }

  for (const sourcePath of sourcePaths) {
    if (/^src\/domains\/[^/]+\/.*\/workflows\/(?:payments|refunds)\//.test(sourcePath)
      || /^src\/domains\/[^/]+\/workflows\/(?:payments|refunds)\//.test(sourcePath)) {
      violations.push(`c6-domain-workflow-owner: ${sourcePath}`)
    }
  }

  try {
    const legacyApiClient = await readFile(path.join(rootDir, 'src/api/client.js'), 'utf8')
    const migratedOrderApiPattern = /export\s+const\s+(getOrders|createOrder|updateOrderStatus|cancelOrder)\b/
    if (migratedOrderApiPattern.test(legacyApiClient)) {
      violations.push('c4-legacy-orders-api: src/api/client.js')
    }
    const migratedTableServiceApiPattern = /export\s+const\s+(createTable|updateTable|reorderTables|transferTableTab|getTableTabDetail)\b/
    if (migratedTableServiceApiPattern.test(legacyApiClient)) {
      violations.push('c5-legacy-table-service-api: src/api/client.js')
    }
    const migratedFinanceApiPattern = /export\s+const\s+(registerPayment|registerTableTabPayment|refundOrder|createMovement|updateMovement|deleteMovement|saveFinanceSettings|updateOrderPaymentPromise)\b/
    if (migratedFinanceApiPattern.test(legacyApiClient)) {
      violations.push('c6-legacy-finance-api: src/api/client.js')
    }
    const migratedCustomerApiPattern = /export\s+(?:const\s+|function\s+)(createClient|updateClient|deleteClient)\b/
    if (migratedCustomerApiPattern.test(legacyApiClient)) {
      violations.push('c7-legacy-customers-api: src/api/client.js')
    }
    if (exportMentionsAny(legacyApiClient, C8_PRODUCT_CRUD_EXPORTS)) {
      violations.push('c8-legacy-catalog-api: src/api/client.js')
    }
    if (exportMentionsAny(legacyApiClient, C9_PRINTING_API_EXPORTS)) {
      violations.push('c9-legacy-printing-api: src/api/client.js')
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }

  try {
    const appSource = await readFile(path.join(rootDir, 'src/App.jsx'), 'utf8')
    if (C7_APP_CUSTOMER_OWNER_PATTERNS.some((pattern) => pattern.test(appSource))) {
      violations.push('c7-app-customer-owner: src/App.jsx')
    }
    if (C7_CLIENT_COLLECTION_MUTATION_PATTERN.test(appSource)) {
      violations.push('c7-customer-update-collection: src/App.jsx')
    }
    if (C8_APP_CATALOG_OWNER_PATTERNS.some((pattern) => pattern.test(appSource))) {
      violations.push('c8-app-catalog-owner: src/App.jsx')
    }
    if (C9_APP_PRINTING_OWNER_PATTERNS.some((pattern) => pattern.test(appSource))) {
      violations.push('c9-app-printing-owner: src/App.jsx')
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }

  for (const sourcePath of sourcePaths) {
    if (!sourcePath.startsWith('src/domains/customers/') || isTestFile(sourcePath)) continue
    const customerSource = await readFile(path.join(rootDir, sourcePath), 'utf8')
    if (C7_CLIENT_COLLECTION_MUTATION_PATTERN.test(customerSource)) {
      violations.push(`c7-customer-update-collection: ${sourcePath}`)
    }
  }

  for (const sourcePath of sourcePaths) {
    if (isTestFile(sourcePath)) continue
    const source = await readFile(path.join(rootDir, sourcePath), 'utf8')
    if (sourcePath === 'src/app/runtime/data/useOperationalDataRuntime.js'
      && C10_RUNTIME_LEGACY_BRIDGE_PATTERN.test(source)) {
      violations.push(`c10-legacy-payment-receipt-bridge: ${sourcePath}`)
    }
    if (sourcePath === 'src/app/runtime/data/useOperationalDataRuntime.js'
      && C8_UPDATE_COLLECTION_PATTERN.test(source)) {
      violations.push(`c10-legacy-update-collection: ${sourcePath}`)
    }
    if (C8_UPDATE_COLLECTION_PATTERN.test(source)) {
      violations.push(`c8-update-collection: ${sourcePath}`)
    }
    if (sourcePath.startsWith('src/domains/catalog/domain/') && C8_DOMAIN_BROWSER_PATTERN.test(source)) {
      violations.push(`catalog-domain-browser: ${sourcePath}`)
    }
    if (isDomainLayer(sourcePath) && usesDomainBrowserApi(source)) {
      violations.push(`domain-browser: ${sourcePath}`)
    }
    if (sourcePath.startsWith('src/domains/printing/domain/') && C9_PRINTING_DOMAIN_BROWSER_PATTERN.test(source)) {
      violations.push(`c9-printing-domain-browser: ${sourcePath}`)
    }
  }

  try {
    const sharedIdentity = await readFile(path.join(rootDir, 'shared/clientIdentity.js'), 'utf8')
    if (C7_SHARED_DUPLICATE_PATTERN.test(sharedIdentity)) {
      violations.push('c7-shared-customer-duplicate: shared/clientIdentity.js')
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }

  try {
    const sharedProductCatalog = await readFile(path.join(rootDir, 'shared/productCatalog.js'), 'utf8')
    if (C8_SHARED_METADATA_PATTERN.test(sharedProductCatalog)) {
      violations.push('c8-shared-catalog-metadata: shared/productCatalog.js')
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }

  const domainEdges = new Map()
  for (const edge of edges) {
    const fromDomain = domainOf(edge.from)
    const targetDomain = domainOf(edge.resolvedPath)

    if (!isTestFile(edge.from)
      && edge.from.startsWith('src/domains/orders/')
      && edge.resolvedPath?.startsWith('src/app/workflows/payments/')) {
      violations.push(`orders-payment-workflow-import: ${edge.from} -> ${edge.resolvedPath}`)
    }

    const printingDomainLayer = edge.from.startsWith('src/domains/printing/domain/')
    if (printingDomainLayer && isReactSpecifier(edge.specifier)) {
      violations.push(`c9-printing-domain-react: ${edge.from} -> ${edge.specifier}`)
    }
    if (printingDomainLayer && edge.specifier === 'qz-tray') {
      violations.push(`c9-printing-domain-qz: ${edge.from} -> ${edge.specifier}`)
    }

    if (!isTestFile(edge.from)
      && !edge.from.startsWith('src/domains/printing/')
      && edge.resolvedPath?.startsWith('src/domains/printing/')
      && edge.resolvedPath !== 'src/domains/printing/index.js') {
      violations.push(`c9-printing-deep-import: ${edge.from} -> ${edge.resolvedPath}`)
    }

    if (edge.from.startsWith('src/domains/printing/')
      && targetDomain
      && C9_PRINTING_PEER_DOMAINS.has(targetDomain)
      && edge.resolvedPath !== `src/domains/${targetDomain}/index.js`) {
      violations.push(`c9-printing-cross-domain-internal: ${edge.from} -> ${edge.resolvedPath}`)
    }

    if (!isTestFile(edge.from)
      && edge.from.startsWith('src/infrastructure/qz/')
      && /^src\/domains\/printing\/(?:domain|application|ui)\//.test(edge.resolvedPath || '')) {
      violations.push(`c9-qz-printing-internal: ${edge.from} -> ${edge.resolvedPath}`)
    }

    if (isDomainLayer(edge.from)) {
      if (isReactSpecifier(edge.specifier)) {
        violations.push(`domain-react: ${edge.from} -> ${edge.specifier}`)
      }
      if (edge.specifier === 'qz-tray') {
        violations.push(`domain-qz: ${edge.from} -> ${edge.specifier}`)
      }
      if (edge.resolvedPath?.startsWith('src/infrastructure/')
        || /^src\/domains\/[^/]+\/infrastructure\//.test(edge.resolvedPath || '')) {
        violations.push(`domain-infrastructure: ${edge.from} -> ${edge.resolvedPath}`)
      }
      if (/^src\/domains\/[^/]+\/ui\//.test(edge.resolvedPath || '')) {
        violations.push(`domain-ui: ${edge.from} -> ${edge.resolvedPath}`)
      }
    }

    if (edge.from.startsWith('src/shared/') && edge.resolvedPath?.startsWith('src/domains/')) {
      violations.push(`shared-domain: ${edge.from} -> ${edge.resolvedPath}`)
    }

    if (!isTestFile(edge.from)
      && targetDomain
      && fromDomain !== targetDomain
      && edge.resolvedPath !== `src/domains/${targetDomain}/index.js`) {
      violations.push(`domain-deep-import: ${edge.from} -> ${edge.resolvedPath}`)
    }

    if (!isTestFile(edge.from)
      && edge.from === 'src/App.jsx'
      && C10_LEGACY_PRODUCTION_ROOTS.some((root) => edge.resolvedPath?.startsWith(`src/${root}/`))) {
      violations.push(`app-legacy-root-import: ${edge.from} -> ${edge.resolvedPath}`)
    }

    if (!isTestFile(edge.from)
      && fromDomain
      && targetDomain
      && fromDomain !== targetDomain
      && edge.resolvedPath === `src/domains/${targetDomain}/index.js`) {
      if (!domainEdges.has(fromDomain)) domainEdges.set(fromDomain, new Set())
      domainEdges.get(fromDomain).add(targetDomain)
      if (!domainEdges.has(targetDomain)) domainEdges.set(targetDomain, new Set())
    }

    if (!isTestFile(edge.from)
      && !edge.from.startsWith('src/domains/orders/')
      && edge.resolvedPath?.startsWith('src/domains/orders/')
      && edge.resolvedPath !== 'src/domains/orders/index.js') {
      violations.push(`orders-deep-import: ${edge.from} -> ${edge.resolvedPath}`)
    }

    if (!isTestFile(edge.from)
      && !edge.from.startsWith('src/domains/customers/')
      && edge.resolvedPath?.startsWith('src/domains/customers/')
      && edge.resolvedPath !== 'src/domains/customers/index.js') {
      violations.push(`customers-deep-import: ${edge.from} -> ${edge.resolvedPath}`)
    }

    if (!isTestFile(edge.from)
      && !edge.from.startsWith('src/domains/catalog/')
      && edge.resolvedPath?.startsWith('src/domains/catalog/')
      && edge.resolvedPath !== 'src/domains/catalog/index.js') {
      violations.push(`catalog-deep-import: ${edge.from} -> ${edge.resolvedPath}`)
    }

    if (edge.from.startsWith('src/domains/catalog/')
      && edge.resolvedPath?.startsWith('src/domains/orders/')) {
      violations.push(`catalog-orders-import: ${edge.from} -> ${edge.resolvedPath}`)
    }

    if (edge.from.startsWith('src/domains/catalog/')
      && edge.resolvedPath?.startsWith('src/domains/finance/')) {
      violations.push(`catalog-finance-import: ${edge.from} -> ${edge.resolvedPath}`)
    }

    if (edge.from.startsWith('src/domains/catalog/')
      && edge.resolvedPath?.startsWith('src/domains/table-service/')) {
      violations.push(`catalog-table-service-import: ${edge.from} -> ${edge.resolvedPath}`)
    }

    if (edge.from.startsWith('src/domains/catalog/')
      && edge.resolvedPath?.startsWith('src/printing/')) {
      violations.push(`catalog-printing-import: ${edge.from} -> ${edge.resolvedPath}`)
    }

    if (edge.from.startsWith('src/domains/catalog/')
      && (edge.specifier === 'qz-tray' || edge.resolvedPath?.startsWith('src/infrastructure/qz/'))) {
      violations.push(`catalog-qz-import: ${edge.from} -> ${edge.resolvedPath || edge.specifier}`)
    }

    if (!isTestFile(edge.from)
      && !edge.from.startsWith('src/domains/catalog/')
      && edge.resolvedPath === 'shared/productCatalog.js') {
      violations.push(`catalog-shared-bypass: ${edge.from} -> ${edge.resolvedPath}`)
    }

    if (edge.from.startsWith('src/domains/customers/')
      && edge.resolvedPath?.startsWith('src/domains/orders/')
      && edge.resolvedPath !== 'src/domains/orders/index.js') {
      violations.push(`customers-orders-internal: ${edge.from} -> ${edge.resolvedPath}`)
    }

    if (edge.from.startsWith('src/domains/orders/')
      && edge.resolvedPath?.startsWith('src/domains/customers/')
      && edge.resolvedPath !== 'src/domains/customers/index.js') {
      violations.push(`orders-customers-internal: ${edge.from} -> ${edge.resolvedPath}`)
    }

    if (!isTestFile(edge.from)
      && !edge.from.startsWith('src/domains/table-service/')
      && edge.resolvedPath?.startsWith('src/domains/table-service/')
      && edge.resolvedPath !== 'src/domains/table-service/index.js') {
      violations.push(`table-service-deep-import: ${edge.from} -> ${edge.resolvedPath}`)
    }

    if (edge.from.startsWith('src/domains/table-service/')
      && edge.resolvedPath?.startsWith('src/domains/orders/')) {
      violations.push(`table-service-orders-import: ${edge.from} -> ${edge.resolvedPath}`)
    }
    if (!isTestFile(edge.from)
      && !edge.from.startsWith('src/domains/finance/')
      && edge.resolvedPath?.startsWith('src/domains/finance/')
      && edge.resolvedPath !== 'src/domains/finance/index.js') {
      violations.push(`finance-deep-import: ${edge.from} -> ${edge.resolvedPath}`)
    }

    if (edge.from.startsWith('src/domains/finance/')
      && edge.resolvedPath?.startsWith('src/domains/orders/')) {
      violations.push(`finance-orders-import: ${edge.from} -> ${edge.resolvedPath}`)
    }

    if (edge.from.startsWith('src/domains/finance/')
      && edge.resolvedPath?.startsWith('src/domains/table-service/')) {
      violations.push(`finance-table-service-import: ${edge.from} -> ${edge.resolvedPath}`)
    }

    if (fromDomain && targetDomain && fromDomain !== targetDomain) {
      const publicEntry = `src/domains/${targetDomain}/index.js`
      if (edge.resolvedPath !== publicEntry) {
        violations.push(`cross-domain-internal: ${edge.from} -> ${edge.resolvedPath}`)
      }
    }

    if (edge.specifier === 'qz-tray'
      && !isTestFile(edge.from)
      && !edge.from.startsWith('src/infrastructure/qz/')) {
      violations.push(`qz-direct: ${edge.from} -> qz-tray`)
    }
    const c6FinanceOrWorkflow = edge.from.startsWith('src/domains/finance/')
      || edge.from.startsWith('src/app/workflows/payments/')
      || edge.from.startsWith('src/app/workflows/refunds/')
    if (c6FinanceOrWorkflow
      && !isTestFile(edge.from)
      && (edge.specifier === 'qz-tray'
        || edge.resolvedPath?.startsWith('src/printing/')
        || edge.resolvedPath?.startsWith('src/infrastructure/qz/'))) {
      violations.push(`c6-finance-payment-printing-import: ${edge.from} -> ${edge.resolvedPath || edge.specifier}`)
    }

    if (edge.from.startsWith('src/app/policy-editing/')) {
      if (edge.resolvedPath?.startsWith('src/app/surfaces/settings/')) {
        violations.push(`policy-settings-surface: ${edge.from} -> ${edge.resolvedPath}`)
      }
      if (edge.resolvedPath?.startsWith('src/pages/') || edge.resolvedPath?.startsWith('src/components/Settings')) {
        violations.push(`policy-concrete-ui: ${edge.from} -> ${edge.resolvedPath}`)
      }
      if (edge.resolvedPath?.startsWith('src/printing/')) {
        violations.push(`policy-printing: ${edge.from} -> ${edge.resolvedPath}`)
      }
    }

    if (edge.from.startsWith('src/app/navigation/') && edge.resolvedPath?.startsWith('src/app/surfaces/settings/')) {
      violations.push(`navigation-settings-surface: ${edge.from} -> ${edge.resolvedPath}`)
    }

    if (edge.from === 'src/App.jsx') {
      if (C3_LEGACY_SETTINGS_OWNERS.has(edge.resolvedPath)) {
        violations.push(`app-c3-legacy-owner: ${edge.from} -> ${edge.resolvedPath}`)
      }
      if (edge.resolvedPath?.startsWith('src/app/surfaces/settings/policies/')) {
        violations.push(`app-settings-policy: ${edge.from} -> ${edge.resolvedPath}`)
      }
    }
  }

  const domainCycle = findDomainCycle(domainEdges)
  if (domainCycle) violations.push(`domain-cycle: ${domainCycle.join(' -> ')}`)

  return [...new Set(violations)].sort()
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isMain) {
  const rootDir = process.cwd()
  const violations = await findArchitectureViolations({ rootDir })
  if (violations.length) {
    for (const violation of violations) console.error(violation)
    process.exitCode = 1
  } else {
    console.log('Frontend architecture boundaries: OK')
  }
}
