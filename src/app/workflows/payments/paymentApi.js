import { apiRequest, withJson } from '../../../infrastructure/api/httpClient.js'

export const createPaymentApi = ({ request = apiRequest, json = withJson } = {}) => Object.freeze({
  registerOrderPayment: (id, method) => request(
    `/api/orders/${encodeURIComponent(id)}/payment`,
    json('POST', { method }),
  ),
  registerTableTabPayment: (id, method) => request(
    `/api/table-tabs/${encodeURIComponent(id)}/payment`,
    json('POST', { method }),
  ),
})

export const paymentApi = createPaymentApi()
