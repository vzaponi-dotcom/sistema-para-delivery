import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const app = fs.readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')

test('App owns persistent tables as an official bootstrap collection', () => {
  assert.match(app, /DATA_COLLECTIONS = \[[^\]]*'tables'/)
  assert.match(app, /const \[tables, setTables\] = useState\(\[\]\)/)
  assert.match(app, /setTables\(\[\]\)/)
  assert.match(app, /guard\.canApply\(token, 'tables'\)[\s\S]*?setTables\(Array\.isArray\(data\?\.tables\) \? data\.tables : \[\]\)/)
})

test('official effects apply table entities and complete table lists without inferring occupancy', () => {
  assert.match(app, /applyOfficialEffects = \(\{[^}]*table, tables: nextTables/)
  assert.match(app, /if \(table\) changed\.push\('tables'\)/)
  assert.match(app, /if \(Array\.isArray\(nextTables\)\) changed\.push\('tables'\)/)
  assert.match(app, /if \(table\) setTables\(\(current\) => upsertById\(current, table\)\)/)
  assert.match(app, /if \(Array\.isArray\(nextTables\)\) setTables\(nextTables\)/)
})

test('App prepares table mutation handlers using official API responses and request keys', () => {
  for (const alias of ['createTableApi', 'updateTableApi', 'reorderTablesApi', 'transferTableTabApi']) {
    assert.match(app, new RegExp(alias))
  }
  for (const handler of ['handleCreateTable', 'handleRenameTable', 'handleSetTableActive', 'handleReorderTables', 'handleTransferTableTab']) {
    assert.match(app, new RegExp(`const ${handler} = async`))
  }
  assert.match(app, /transferTableTabApi\(sourceTableId, destinationTableId\)[\s\S]*?applyOfficialEffects\(\{ tables: result\.tables, tableTab: result\.tableTab \}\)/)
})

test('NewOrder receives the official tables collection for registered table selection', () => {
  assert.match(app, /<NewOrder[\s\S]*?tables=\{tables\}/)
})
