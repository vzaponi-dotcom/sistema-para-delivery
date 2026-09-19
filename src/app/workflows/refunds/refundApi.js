import { apiRequest, withJson } from '../../../infrastructure/api/httpClient.js'

export const createRefundApi = ({ request = apiRequest, json = withJson } = {}) => Object.freeze({
  refundOrder: (id, payload) => request(
    `/api/orders/${encodeURIComponent(id)}/refund`,
    json('POST', payload),
  ),
})

export const refundApi = createRefundApi()
