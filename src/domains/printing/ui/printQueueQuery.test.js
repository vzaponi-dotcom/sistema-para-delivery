import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_PRINT_QUEUE_QUERY,
  togglePrintQueueSort,
  updatePrintQueueQuery,
} from './printQueueQuery.js'

test('operational query starts newest first with the fixed backend page size', () => {
  assert.deepEqual(DEFAULT_PRINT_QUEUE_QUERY, {
    page: 1,
    pageSize: 10,
    sortBy: 'createdAt',
    sortDir: 'desc',
    status: '',
    trigger: '',
    search: '',
  })
})

test('sorting toggles the current column and starts a new column descending from page one', () => {
  const pageTwo = { ...DEFAULT_PRINT_QUEUE_QUERY, page: 2 }

  assert.deepEqual(togglePrintQueueSort(pageTwo, 'createdAt'), {
    ...DEFAULT_PRINT_QUEUE_QUERY,
    sortDir: 'asc',
  })
  assert.deepEqual(togglePrintQueueSort(pageTwo, 'orderNumber'), {
    ...DEFAULT_PRINT_QUEUE_QUERY,
    sortBy: 'orderNumber',
  })
})

test('changing an operational filter resets only the page and retains the fixed page size', () => {
  assert.deepEqual(updatePrintQueueQuery({ ...DEFAULT_PRINT_QUEUE_QUERY, page: 3, status: 'pending' }, { search: 'Mesa 7' }), {
    ...DEFAULT_PRINT_QUEUE_QUERY,
    status: 'pending',
    search: 'Mesa 7',
  })
  assert.deepEqual(updatePrintQueueQuery({ ...DEFAULT_PRINT_QUEUE_QUERY, page: 3 }, { page: 2 }), {
    ...DEFAULT_PRINT_QUEUE_QUERY,
    page: 2,
  })
})
