import { apiRequest, withJson } from '../../../infrastructure/api/httpClient.js'
export const createPlatformApi = ({ request = apiRequest } = {}) => Object.freeze({
  manageBusiness: (target,input,idempotencyKey) => {
    const paths={suspend:'suspend',resume:'resume',delete:'delete',restore:'restore','membership.revoke':`memberships/${encodeURIComponent(target.userId)}/revoke`,'membership.reactivate':`memberships/${encodeURIComponent(target.userId)}/reactivate`,'invitation.cancel':`invitations/${encodeURIComponent(target.invitationId)}/cancel`,'invitation.resend':`invitations/${encodeURIComponent(target.invitationId)}/resend`}
    if (!Object.hasOwn(paths,target.operation)) throw new TypeError('Ação administrativa inválida.')
    return request(`/api/platform/businesses/${encodeURIComponent(target.businessId)}/${paths[target.operation]}`,{...withJson('POST',input),headers:{'Idempotency-Key':idempotencyKey}})
  },
  getManagementAttempt: (id,key,options={}) => request(`/api/platform/businesses/${encodeURIComponent(id)}/management-attempts/${encodeURIComponent(key)}`,options),
  listMemberships: (id,options={}) => request(`/api/platform/businesses/${encodeURIComponent(id)}/memberships`,options),
  listHistory: (id,input={},options={}) => {
    const query=new URLSearchParams(Object.entries(input).filter(([,value])=>value!==null && value!==undefined && value!==''))
    return request(`/api/platform/businesses/${encodeURIComponent(id)}/history${query.size?`?${query}`:''}`,options)
  },
  listBusinesses: (input = {}, options = {}) => {
    const query = new URLSearchParams(Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== ''))
    return request(`/api/platform/businesses${query.size ? `?${query}` : ''}`, options)
  },
  getBusiness: (id, options = {}) => request(`/api/platform/businesses/${encodeURIComponent(id)}`, options),
  createBusiness: (input, idempotencyKey) => request('/api/platform/businesses', { ...withJson('POST', input), headers: { 'Idempotency-Key': idempotencyKey } }),
  resendFirstManagerInvitation: id => request(`/api/platform/businesses/${encodeURIComponent(id)}/first-manager-invitation/resend`, { method: 'POST' }),
})
export const platformApi = createPlatformApi()
