import { DEFAULT_PRINT_QUEUE_QUERY } from '../../domains/printing/index.js'

const QUERY_FIELDS = Object.freeze({
  orders: Object.freeze(['search']),
  history: Object.freeze(['filter', 'analysisPeriod', 'search', 'period', 'startDate', 'endDate']),
  dashboard: Object.freeze(['period', 'valuesVisible']),
  clients: Object.freeze(['search', 'sort']),
  products: Object.freeze(['search', 'categoryFilter']),
  receivables: Object.freeze([
    'search',
    'displayMode',
    'activeView',
    'timingFilter',
    'sortMode',
    'exactDateFilter',
    'selectedEntryKey',
  ]),
  printQueue: Object.freeze(Object.keys(DEFAULT_PRINT_QUEUE_QUERY)),
})

export function createQueryContext() {
  return {
    orders: { search: '' },
    history: { filter: 'all', analysisPeriod: '30d', search: '', period: 'today', startDate: '', endDate: '' },
    dashboard: { period: '30d', valuesVisible: true },
    clients: { search: '', sort: 'name-asc' },
    products: { search: '', categoryFilter: 'Todos' },
    receivables: {
      search: '',
      displayMode: 'client',
      activeView: 'pending',
      timingFilter: 'all',
      sortMode: 'urgency',
      exactDateFilter: null,
      selectedEntryKey: null,
    },
    printQueue: { ...DEFAULT_PRINT_QUEUE_QUERY },
  }
}

export function patchQueryContext(state, page, patch) {
  const fields = QUERY_FIELDS[page]
  if (!fields || !patch || typeof patch !== 'object') return state

  const allowedPatch = {}
  for (const field of fields) {
    if (!Object.hasOwn(patch, field)) continue
    if (page === 'receivables' && field === 'displayMode' && !['client', 'orders'].includes(patch[field])) continue
    allowedPatch[field] = patch[field]
  }
  if (!Object.keys(allowedPatch).length) return state

  return {
    ...state,
    [page]: { ...state[page], ...allowedPatch },
  }
}
