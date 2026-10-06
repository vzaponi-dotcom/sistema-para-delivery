import { apiError, assertSameOriginMutation, handleError, json, readJson } from '../http.js'
import { requireIdentityContext } from '../tenancy/businessContext.js'
import { requireCurrentPlatformCapability } from './access.js'
import { listPlatformBusinesses, getPlatformBusiness } from './businessesRepository.js'
import { createBusiness } from './businessProvisioning.js'
import { resendCompanyInvitation } from '../tenancy/companyInvitations.js'
import { performBusinessManagement } from './managementCommands.js'
import { MANAGEMENT_CAPABILITIES } from './managementTransactions.js'
import { listPlatformMemberships, listPlatformHistory, getPlatformManagementAttempt } from './managementRepository.js'

const response = (body, status = 200) => json(body, { status, headers: { 'cache-control': 'no-store' } })
export async function handlePlatformBusinessesApi(request, env, context, options = {}) {
  const url = new URL(request.url), path = url.pathname, now = options.now || new Date()
  const item = path.match(/^\/api\/platform\/businesses\/([^/]+)$/), resend = path.match(/^\/api\/platform\/businesses\/([^/]+)\/first-manager-invitation\/resend$/)
  const management=path.match(/^\/api\/platform\/businesses\/([^/]+)\/(suspend|resume|delete|restore|memberships|history|management-attempts\/[^/]+|memberships\/[^/]+\/(?:revoke|reactivate)|invitations\/[^/]+\/(?:cancel|resend))$/)
  if (path !== '/api/platform/businesses' && !item && !resend && !management) return null
  try {
    requireIdentityContext(request, context)
    assertSameOriginMutation(request)
    const capability = resend ? 'platform.invitations.resend' : request.method === 'POST' && path === '/api/platform/businesses' ? 'platform.businesses.create' : 'platform.businesses.view'
    await requireCurrentPlatformCapability(env.DB, context, capability, now)
    if (management) {
      let businessId,parts
      try { businessId=decodeURIComponent(management[1]);parts=management[2].split('/').map(decodeURIComponent) } catch { throw apiError(400,'INVALID_BUSINESS_PATH','Endereço de empresa inválido.') }
      const read=(parts[0]==='memberships' && parts.length===1)||['history','management-attempts'].includes(parts[0])
      if (request.method!==(read?'GET':'POST')) return response({error:{code:'METHOD_NOT_ALLOWED',message:'Método não permitido.'}},405)
      if (read) {
        let data,required=parts[0]==='memberships'?'platform.memberships.view':'platform.businesses.view'
        await requireCurrentPlatformCapability(env.DB,context,required,now)
        if (parts[0]==='memberships') data=await listPlatformMemberships(env.DB,businessId,now)
        else if (parts[0]==='history') data=await listPlatformHistory(env.DB,businessId,Object.fromEntries(url.searchParams))
        else {data=await getPlatformManagementAttempt(env.DB,context.accountId,businessId,parts[1]);required=MANAGEMENT_CAPABILITIES[data.result.operation]}
        await requireCurrentPlatformCapability(env.DB,context,required,now)
        return response(data)
      }
      const target={businessId,operation:parts.length===1?parts[0]:`${parts[0]==='memberships'?'membership':'invitation'}.${parts[2]}`,...(parts[0]==='memberships'?{userId:parts[1]}:parts[0]==='invitations'?{invitationId:parts[1]}:{})}
      return response(await performBusinessManagement(env,context,target,await readJson(request),{...options,now,idempotencyKey:request.headers.get('Idempotency-Key')}))
    }
    if (path === '/api/platform/businesses' && request.method === 'GET') {
      const data = await listPlatformBusinesses(env.DB, { ...Object.fromEntries(url.searchParams), now })
      await requireCurrentPlatformCapability(env.DB, context, capability, now)
      return response(data)
    }
    if (path === '/api/platform/businesses' && request.method === 'POST') {
      const { idempotencyKey: bodyKey, ...input } = await readJson(request), headerKey = request.headers.get('Idempotency-Key')
      if (bodyKey && headerKey && bodyKey !== headerKey) throw apiError(400, 'INVALID_IDEMPOTENCY_KEY', 'Tentativa de cadastro inválida.')
      const data = await createBusiness(env, context, input, { ...options, now, idempotencyKey: headerKey || bodyKey })
      return response(data, data.created ? 201 : 200)
    }
    if (item && request.method === 'GET') {
      const data = await getPlatformBusiness(env.DB, decodeURIComponent(item[1]), now)
      await requireCurrentPlatformCapability(env.DB, context, capability, now)
      return response(data)
    }
    if (resend && request.method === 'POST') {
      const business = await getPlatformBusiness(env.DB, decodeURIComponent(resend[1]), now)
      if (!business.invitation?.canResend) throw apiError(409, 'INITIAL_INVITATION_UNAVAILABLE', 'O acesso já foi ativado ou o vínculo não permite reenvio.')
      return response(await resendCompanyInvitation(env, context, business.invitation.id, { ...options, now }))
    }
    return response({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }, 405)
  } catch (error) { const result = handleError(error); result.headers.set('cache-control', 'no-store'); return result }
}
