import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

test('app guards global navigation away from a dirty new order', () => {
  const app = source('./App.jsx')

  assert.match(app, /newOrderDirty/)
  assert.match(app, /pendingNavigationTab/)
  assert.match(app, /shouldConfirmNewOrderExit/)
  assert.match(app, /onNavigate=\{requestNavigation\}/)
  assert.match(app, /onDraftDirtyChange=\{setNewOrderDirty\}/)
  assert.match(app, /Descartar venda em andamento\?/)
  assert.match(app, /Continuar na venda/)
  assert.match(app, /Descartar venda/)
})

test('new order reports dirty state without moving cart state to App', () => {
  const page = source('./pages/NewOrder.jsx')
  const app = source('./App.jsx')

  assert.match(page, /createNewOrderDirtySnapshot/)
  assert.match(page, /isNewOrderDraftDirty/)
  assert.match(page, /onDraftDirtyChange/)
  assert.doesNotMatch(app, /const \[items, setItems\] = useState/)
})
