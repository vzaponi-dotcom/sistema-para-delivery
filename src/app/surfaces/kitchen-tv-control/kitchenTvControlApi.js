import { apiRequest, withJson } from '../../../infrastructure/api/httpClient.js'

export const createKitchenTvControlApi = ({ request = apiRequest } = {}) => {
const getKitchenTvControl = () => request('/api/kitchen-tv/control')
const getKitchenTvOrderPrintDocument = (orderId) => request(`/api/orders/${encodeURIComponent(orderId)}/print-document`)
const setKitchenTvPage = (page) => request('/api/kitchen-tv/control/page', withJson('PATCH', { page }))
const setKitchenTvModality = (modality) => request('/api/kitchen-tv/control/modality', withJson('PATCH', { modality }))

const hideKitchenTvOrder = (orderId) => request(`/api/kitchen-tv/control/orders/${encodeURIComponent(orderId)}/hidden`, { method: 'PUT' })
const restoreKitchenTvOrder = (orderId) => request(`/api/kitchen-tv/control/orders/${encodeURIComponent(orderId)}/hidden`, { method: 'DELETE' })

return Object.freeze({ getKitchenTvControl, getKitchenTvOrderPrintDocument, setKitchenTvPage, setKitchenTvModality, hideKitchenTvOrder, restoreKitchenTvOrder })
}
export const { getKitchenTvControl, getKitchenTvOrderPrintDocument, setKitchenTvPage, setKitchenTvModality, hideKitchenTvOrder, restoreKitchenTvOrder } = createKitchenTvControlApi()
