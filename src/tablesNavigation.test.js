import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('mobile More navigation recognizes and opens Mesas', async () => {
  const navigation = await read('./components/MobileNavigation.jsx')

  assert.match(navigation, /moreEntries = \[[\s\S]*?\{ id: 'tables', icon: 'table' \}/)
  assert.match(navigation, /activeTab === item\.id/)
  assert.match(navigation, /onClick=\{\(\) => onNavigate\(item\.id\)\}/)
})

test('desktop navigation includes Mesas', async () => {
  const sidebar = await read('./components/Sidebar.jsx')

  assert.match(sidebar, /\{ id: 'tables', label: 'Mesas', icon: 'table' \}/)
})

test('App renders the table workspace with official data and callbacks', async () => {
  const app = await read('./App.jsx')

  assert.match(app, /import Tables from '\.\/pages\/Tables'/)
  assert.match(app, /activeTab === 'tables'[\s\S]*?<Tables[\s\S]*?tables=\{tables\}[\s\S]*?disabled=\{writesBlocked\}[\s\S]*?onCreate=\{handleCreateTable\}[\s\S]*?onRename=\{handleRenameTable\}[\s\S]*?onSetActive=\{handleSetTableActive\}[\s\S]*?onReorder=\{handleReorderTables\}[\s\S]*?onOpenComanda=\{handleOpenComanda\}/)
})
