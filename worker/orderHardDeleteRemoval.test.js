import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('order repositories no longer expose or implement hard delete', async () => {
  const repositories = await read('./repositories.js')
  const orderTests = await read('./orderRepositories.test.js')

  assert.doesNotMatch(repositories, /export const deleteOrder/)
  assert.doesNotMatch(repositories, /DELETE FROM orders WHERE id = \? AND business_id = \?/)
  assert.doesNotMatch(orderTests, /\bdeleteOrder\b/)
  assert.doesNotMatch(orderTests, /delet(?:e|ing).*order/i)
})
