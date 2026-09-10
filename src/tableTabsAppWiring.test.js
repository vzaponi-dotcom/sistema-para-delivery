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

test('App owns table tabs from bootstrap and passes them to the order flow only', () => {
  assert.match(app, /const \[tableTabs, setTableTabs\] = useState\(\[\]\)/)
  assert.match(app, /setTableTabs\(Array\.isArray\(data\?\.tableTabs\) \? data\.tableTabs : \[\]\)/)
  assert.match(app, /<NewOrder[\s\S]*?tableTabs=\{tableTabs\}/)
  const receivables = app.match(/\{activeTab === 'receivables' && <Receivables[^>]*\/>\}/)?.[0] || ''
  assert.doesNotMatch(receivables, /tableTabs/)
  assert.doesNotMatch(receivables, /onRegisterTableTabPayment/)
  assert.match(app, /const handleRegisterTableTabPayment = async/)
})

test('table transfer applies the returned table list and table tab in one official effect', () => {
  assert.match(app, /applyOfficialEffects\(\{ tables: result\.tables, tableTab: result\.tableTab \}\)/)
})
