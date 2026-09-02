import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

test('normal client form blocks duplicate phones and opens the in-app duplicate-name modal', () => {
  const app = source('./App.jsx')

  assert.match(app, /findClientDuplicates/)
  assert.match(app, /Telefone já cadastrado para/)
  assert.match(app, /ClientDuplicateModal/)
  assert.match(app, /duplicateClientDialog/)
  assert.match(app, /handleUseExistingClient/)
  assert.match(app, /handleConfirmDuplicateClient/)
  assert.doesNotMatch(app, /window\.confirm/)
  assert.doesNotMatch(app, /phone:\s*newClient\.phone\s*\|\|\s*['"]\(00\) 00000-0000['"]/)
})

test('quick client inside new order can use the existing client or continue duplicate-name registration', () => {
  const page = source('./pages/NewOrder.jsx')

  assert.match(page, /findClientDuplicates/)
  assert.match(page, /Telefone já cadastrado para/)
  assert.match(page, /ClientDuplicateModal/)
  assert.match(page, /duplicateClient/)
  assert.match(page, /handleUseExistingDuplicate/)
  assert.match(page, /handleConfirmDuplicate/)
  assert.doesNotMatch(page, /window\.confirm/)
  assert.match(page, /role="alert"/)
})

test('duplicate client modal shows the existing client and all three choices', () => {
  const app = source('./App.jsx')
  const page = source('./pages/NewOrder.jsx')

  for (const content of [app, page]) {
    assert.match(content, /Cancelar/)
    assert.match(content, /Usar cliente existente/)
    assert.match(content, /Cadastrar mesmo assim/)
  }
})
