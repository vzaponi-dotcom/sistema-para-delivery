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

const exactAllowed = (allowlist, key, value) => Array.isArray(allowlist?.[key]) && allowlist[key].includes(value)

export const findArchitectureViolations = async ({ rootDir, allowlist = {} }) => {
  const edges = await collectImportEdges(rootDir)
  const sourcePaths = new Set((await listSourceFiles(path.join(rootDir, 'src'))).map((file) => repoRelative(rootDir, file)))
  const violations = []

  for (const legacyOwner of C3_LEGACY_SETTINGS_OWNERS) {
    if (sourcePaths.has(legacyOwner)) violations.push(`c3-legacy-owner: ${legacyOwner}`)
  }

  for (const legacyOwner of C4_LEGACY_ORDERS_OWNERS) {
    if (sourcePaths.has(legacyOwner)) violations.push(`c4-legacy-orders-owner: ${legacyOwner}`)
  }

  for (const legacyOwner of C5_LEGACY_TABLE_SERVICE_OWNERS) {
    if (sourcePaths.has(legacyOwner)) violations.push(`c5-legacy-table-service-owner: ${legacyOwner}`)
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
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }

  for (const edge of edges) {
    const fromDomain = domainOf(edge.from)
    const targetDomain = domainOf(edge.resolvedPath)

    if (isDomainLayer(edge.from)) {
      if (isReactSpecifier(edge.specifier)) {
        violations.push(`domain-react: ${edge.from} -> ${edge.specifier}`)
      }
      if (edge.specifier === 'qz-tray') {
        violations.push(`domain-qz: ${edge.from} -> ${edge.specifier}`)
      }
      if (edge.resolvedPath?.startsWith('src/infrastructure/')) {
        violations.push(`domain-infrastructure: ${edge.from} -> ${edge.resolvedPath}`)
      }
      if (/^src\/domains\/[^/]+\/ui\//.test(edge.resolvedPath || '')) {
        violations.push(`domain-ui: ${edge.from} -> ${edge.resolvedPath}`)
      }
    }

    if (edge.from.startsWith('src/shared/') && edge.resolvedPath?.startsWith('src/domains/')) {
      violations.push(`shared-domain: ${edge.from} -> ${edge.resolvedPath}`)
    }

    if (!edge.from.startsWith('src/domains/orders/')
      && edge.resolvedPath?.startsWith('src/domains/orders/')
      && edge.resolvedPath !== 'src/domains/orders/index.js') {
      violations.push(`orders-deep-import: ${edge.from} -> ${edge.resolvedPath}`)
    }

    if (!edge.from.startsWith('src/domains/table-service/')
      && edge.resolvedPath?.startsWith('src/domains/table-service/')
      && edge.resolvedPath !== 'src/domains/table-service/index.js') {
      violations.push(`table-service-deep-import: ${edge.from} -> ${edge.resolvedPath}`)
    }

    if (edge.from.startsWith('src/domains/table-service/')
      && edge.resolvedPath?.startsWith('src/domains/orders/')) {
      violations.push(`table-service-orders-import: ${edge.from} -> ${edge.resolvedPath}`)
    }

    if (fromDomain && targetDomain && fromDomain !== targetDomain) {
      const publicEntry = `src/domains/${targetDomain}/index.js`
      if (edge.resolvedPath !== publicEntry && !exactAllowed(allowlist, 'crossDomainInternals', `${edge.from} -> ${edge.resolvedPath}`)) {
        violations.push(`cross-domain-internal: ${edge.from} -> ${edge.resolvedPath}`)
      }
    }

    if (edge.specifier === 'qz-tray'
      && !isTestFile(edge.from)
      && !edge.from.startsWith('src/infrastructure/qz/')
      && !exactAllowed(allowlist, 'qzDirectImports', edge.from)) {
      violations.push(`qz-direct: ${edge.from} -> qz-tray`)
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

  return [...new Set(violations)].sort()
}

const loadDefaultAllowlist = async (rootDir) => {
  const file = path.join(rootDir, 'scripts/architecture/legacy-import-allowlist.json')
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return {}
    throw error
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isMain) {
  const rootDir = process.cwd()
  const allowlist = await loadDefaultAllowlist(rootDir)
  const violations = await findArchitectureViolations({ rootDir, allowlist })
  if (violations.length) {
    for (const violation of violations) console.error(violation)
    process.exitCode = 1
  } else {
    console.log('Frontend architecture boundaries: OK')
  }
}
