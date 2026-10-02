import { assertSameOriginMutation, handleError, json, readJson } from '../http.js'
import { authenticateAccountRequest } from '../identity/sessions.js'
import { requireIdentityContext } from './businessContext.js'
import { inspectCompanyInvitation, acceptCompanyInvitation } from './companyInvitations.js'

const response = (body, init = {}) => json(body, { ...init, headers: { 'cache-control': 'no-store', ...init.headers } })
export async function handleCompanyInvitationsApi(request, env, { now = new Date() } = {}) {
  const path = new URL(request.url).pathname
  if (!['/api/auth/company-invitations/inspect', '/api/auth/company-invitations/accept'].includes(path)) return null
  if (request.method !== 'POST') return response({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }, { status: 405 })
  try {
    assertSameOriginMutation(request)
    const body = await readJson(request)
    if (path.endsWith('/inspect')) return response(await inspectCompanyInvitation(env.DB, { token: body.token, now }))
    const context = await authenticateAccountRequest(request, env, now)
    if (context) requireIdentityContext(request, context)
    return response(await acceptCompanyInvitation(env.DB, { token: body.token, password: body.password, context, now }))
  } catch (error) { const result = handleError(error); result.headers.set('cache-control', 'no-store'); return result }
}
