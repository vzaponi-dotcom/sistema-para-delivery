import test from 'node:test'
import assert from 'node:assert/strict'
import { filterAndSortClients } from './clientList.js'

const clients = [
  { id: 'c1', name: 'Zeca', phone: '(11) 99999-0000', address: 'Centro' },
  { id: 'c2', name: 'Ana', phone: '(15) 98888-1111', address: 'Jardim Europa' },
  { id: 'c3', name: 'Bruno', phone: '', address: 'Vila Nova' },
]

test('customer list search matches name phone and address using the current trim/case semantics', () => {
  assert.deepEqual(filterAndSortClients(clients, { search: '  ANA ', sort: 'name-asc' }).map(({ id }) => id), ['c2'])
  assert.deepEqual(filterAndSortClients(clients, { search: '99999', sort: 'name-asc' }).map(({ id }) => id), ['c1'])
  assert.deepEqual(filterAndSortClients(clients, { search: 'vila nova', sort: 'name-asc' }).map(({ id }) => id), ['c3'])
})

test('customer list preserves current name localeCompare ordering for both directions', () => {
  assert.deepEqual(filterAndSortClients(clients, { search: '', sort: 'name-asc' }).map(({ name }) => name), ['Ana', 'Bruno', 'Zeca'])
  assert.deepEqual(filterAndSortClients(clients, { search: '', sort: 'name-desc' }).map(({ name }) => name), ['Zeca', 'Bruno', 'Ana'])
})
