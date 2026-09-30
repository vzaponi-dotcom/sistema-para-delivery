import { apiRequest, withJson } from '../../../infrastructure/api/httpClient.js'

const queryString = (filters = {}) => {
  const params = new URLSearchParams()
  for (const key of ['status', 'from', 'to', 'tableId']) {
    const value = filters?.[key]
    if (value !== null && value !== undefined && value !== '') params.set(key, String(value))
  }
  return params.toString()
}

export const createTableReservationApi = ({
  request = apiRequest,
  json = withJson,
  randomUUID = () => crypto.randomUUID(),
} = {}) => Object.freeze({
  listReservations: (filters = {}, options) => {
    const search = queryString(filters)
    return request(`/api/table-reservations${search ? `?${search}` : ''}`, options)
  },
  getReservation: (id, options) => request(
    `/api/table-reservations/${encodeURIComponent(id)}`,
    options,
  ),
  updateReservation: (id, payload) => request(
    `/api/table-reservations/${encodeURIComponent(id)}`,
    json('PUT', payload),
  ),
  confirmArrival: (id, expectedRevision, mutationId = randomUUID()) => request(
    `/api/table-reservations/${encodeURIComponent(id)}/confirm-arrival`,
    json('POST', { expectedRevision, mutationId }),
  ),
  cancelReservation: (id, payload) => request(
    `/api/table-reservations/${encodeURIComponent(id)}/cancel`,
    json('POST', payload),
  ),
  markNoShow: (id, payload) => request(
    `/api/table-reservations/${encodeURIComponent(id)}/no-show`,
    json('POST', payload),
  ),
})

export const tableReservationApi = createTableReservationApi()
