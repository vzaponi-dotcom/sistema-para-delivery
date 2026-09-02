import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

test('normal client form blocks duplicate phones and confirms duplicate names before create or edit', () => {
  const app = source('./App.jsx')

  assert.match(app, /findClientDuplicates/)
  assert.match(app, /Telefone já cadastrado para/)
  assert.match(app, /Já existe um cliente chamado/)
  assert.match(app, /Deseja cadastrar mesmo assim\?/)
  assert.match(app, /window\.confirm/)
  assert.doesNotMatch(app, /phone:\s*newClient\.phone\s*\|\|\s*['"]\(00\) 00000-0000['"]/)
})

test('quick client inside new order applies the same duplicate phone and name rules', () => {
  const page = source('./pages/NewOrder.jsx')

  assert.match(page, /findClientDuplicates/)
  assert.match(page, /Telefone já cadastrado para/)
  assert.match(page, /Já existe um cliente chamado/)
  assert.match(page, /Deseja cadastrar mesmo assim\?/)
  assert.match(page, /role="alert"/)
})
