import { apiRequest, withJson } from '../../../infrastructure/api/httpClient.js'

export const createPaymentApi = ({ request = apiRequest, json = withJson } = {}) => Object.freeze({
  registerOrderPayment: (id, allocations) => request(
    `/api/orders/${encodeURIComponent(id)}/payment`,
    json('POST', { allocations }),
  ),
  registerTableTabPayment: (id, method) => request(
    `/api/table-tabs/${encodeURIComponent(id)}/payment`,
    json('POST', { method }),
  ),
})

export const paymentApi = createPaymentApi()
