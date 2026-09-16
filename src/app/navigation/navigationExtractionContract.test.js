import test from 'node:test'
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'

const legacyPaths = [
  'src/app/navigation.js',
  'src/app/useNavigationController.js',
  'src/app/queryContext.js',
  'src/app/useQueryContext.js',
  'src/components/AppShell.jsx',
  'src/components/Sidebar.jsx',
  'src/components/MobileNavigation.jsx',
  'src/components/AreaNavigation.jsx',
  'src/utils/mobileNavigation.js',
]

test('C2 remove caminhos legados de shell/navigation', async () => {
  for (const path of legacyPaths) await assert.rejects(access(path), { code: 'ENOENT' })
})

test('App preserva sinais operacionais sem redefinir navegação extraída', async () => {
  const source = await readFile('src/App.jsx', 'utf8')
  assert.equal(source.includes('SETTINGS_DRAFT_ROUTES'), false)
  assert.equal(source.includes("addEventListener('app:navigate'"), false)
  assert.equal(source.includes('DESKTOP_NAV_GROUPS'), false)
  assert.equal(source.includes('MOBILE_DIRECT_ENTRIES'), false)
  assert.match(source, /ordersSyncEnabled:\s*activeTab === 'orders'/)
  assert.match(source, /active:\s*activeTab === 'orders'/)
  assert.match(source, /activeMobileEntry\s*=\s*activeTab === 'new-order' \? newOrderContext\.returnTab/)
  assert.match(source, /requestNavigation\(newOrderContext\.returnTab\)/)
})
