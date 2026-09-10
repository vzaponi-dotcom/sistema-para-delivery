export const DEFAULT_PRINT_QUEUE_QUERY = Object.freeze({
  page: 1,
  pageSize: 10,
  sortBy: 'createdAt',
  sortDir: 'desc',
  status: '',
  trigger: '',
  search: '',
})

const QUERY_RESET_KEYS = new Set(['sortBy', 'sortDir', 'status', 'trigger', 'search'])

export const updatePrintQueueQuery = (current = DEFAULT_PRINT_QUEUE_QUERY, changes = {}) => {
  const next = { ...DEFAULT_PRINT_QUEUE_QUERY, ...current, ...changes, pageSize: 10 }
  const resetsPage = Object.keys(changes).some((key) => QUERY_RESET_KEYS.has(key) && next[key] !== current[key])
  return { ...next, page: resetsPage ? 1 : Math.max(1, Number(next.page) || 1) }
}

export const togglePrintQueueSort = (query = DEFAULT_PRINT_QUEUE_QUERY, sortBy) => updatePrintQueueQuery(query, {
  sortBy,
  sortDir: query.sortBy === sortBy && query.sortDir === 'desc' ? 'asc' : 'desc',
})
