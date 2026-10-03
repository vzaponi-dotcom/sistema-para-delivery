import { apiRequest, withJson } from '../../../infrastructure/api/httpClient.js'

export const createKitchenTvSettingsApi = ({ request = apiRequest } = {}) => {
const getKitchenTvSettings = () => request('/api/kitchen-tv/settings')
const approveKitchenTvPairing = (code) => request('/api/kitchen-tv/approve', withJson('POST', { code }))
const revokeKitchenTvAccess = () => request('/api/kitchen-tv/revoke', { method: 'POST' })

return Object.freeze({ getKitchenTvSettings, approveKitchenTvPairing, revokeKitchenTvAccess })
}
export const { getKitchenTvSettings, approveKitchenTvPairing, revokeKitchenTvAccess } = createKitchenTvSettingsApi()
