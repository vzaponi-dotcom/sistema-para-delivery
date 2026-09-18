import { apiRequest, withJson } from '../../../infrastructure/api/httpClient.js'

export const createTableServiceApi = ({
  request = apiRequest,
  json = withJson,
} = {}) => Object.freeze({
  createTable: (table) => request('/api/tables', json('POST', table)),
  updateTable: (id, patch) => request(
    `/api/tables/${encodeURIComponent(id)}`,
    json('PATCH', patch),
  ),
  reorderTables: (tableIds) => request(
    '/api/tables/order',
    json('PUT', { tableIds }),
  ),
  transferTableTab: (sourceTableId, destinationTableId, expectedTableTabId) => request(
    `/api/tables/${encodeURIComponent(sourceTableId)}/transfer`,
    json('POST', { destinationTableId, expectedTableTabId }),
  ),
  getTableTabDetail: (id) => request(
    `/api/table-tabs/${encodeURIComponent(id)}`,
  ),
})

export const tableServiceApi = createTableServiceApi()
