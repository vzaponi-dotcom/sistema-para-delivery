import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app = fs.readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const api = fs.readFileSync(new URL('./api/client.js', import.meta.url), 'utf8')

test('frontend exposes the consolidated table tab payment API helper', () => {
  assert.match(api, /export const registerTableTabPayment = \(id, method\)/)
  assert.match(api, /\/api\/table-tabs\/\$\{encodeURIComponent\(id\)\}\/payment/)
  assert.match(api, /withJson\('POST', \{ method \}\)/)
})

test('table transfer applies the returned table list and table tab in one official effect', () => {
  assert.match(app, /applyOfficialEffects\(\{ tables: result\.tables, tableTab: result\.tableTab \}\)/)
})

test('bootstrap table tabs remain available to the new-order flow', () => {
  assert.ok(app.includes("setTableTabs(Array.isArray(data?.tableTabs) ? data.tableTabs : [])"))
  const newOrderRender = app.split('\n').find((line) => line.includes("activeTab === 'new-order' && <NewOrder"))
  assert.ok(newOrderRender?.includes('tableTabs={tableTabs}'))
})
