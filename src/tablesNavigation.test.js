import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('mobile More navigation recognizes and opens Mesas', async () => {
  const navigation = await read('./app/navigation/registry.js')

  assert.match(navigation, /MOBILE_MORE_ENTRIES = Object\.freeze\(\[[\s\S]*?\{ id: 'tables', icon: 'table' \}/)
})

test('desktop navigation includes Mesas', async () => {
  const sidebar = await read('./app/navigation/registry.js')

  assert.match(sidebar, /\{ id: 'tables', label: 'Mesas', icon: 'table' \}/)
})

test('App renders the table workspace with official data and callbacks', async () => {
  const app = await read('./App.jsx')

  assert.match(app, /import \{[\s\S]*?\bTables,[\s\S]*?\} from '\.\/domains\/table-service\/index\.js'/)
  assert.doesNotMatch(app, /import Tables from '\.\/pages\/Tables'/)
  assert.match(app, /activeTab === 'tables'[\s\S]*?<Tables[\s\S]*?tables=\{tables\}[\s\S]*?disabled=\{writesBlocked\}[\s\S]*?onCreate=\{tableServiceCommands\.createTable\}[\s\S]*?onRename=\{tableServiceCommands\.renameTable\}[\s\S]*?onSetActive=\{tableServiceCommands\.setTableActive\}[\s\S]*?onReorder=\{tableServiceCommands\.reorderTables\}[\s\S]*?onOpenComanda=\{handleOpenComanda\}/)
})
