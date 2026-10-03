import { assertSameOriginMutation, json, readJson } from '../http.js'
import { sessionCookie, accountSessionCookie, clearAccountSessionCookie } from '../auth.js'
import { requireIdentityContext } from '../tenancy/businessContext.js'
import { requireCapability } from '../settingsAccess.js'
import { SESSION_DURATIONS } from './sessions.js'
import { listUsers, createUser, updateUser, requestCredentialReset, resendInvitation, changeOwnPassword } from './users.js'
import { listActivity } from './audit.js'

const response=(data,init={})=>json(data,{...init,headers:{'cache-control':'no-store',...init.headers}})
export async function handleAccessApi(request,env,context,url) {
  if(context?.accountId) requireIdentityContext(request,context)
  if(url.pathname==='/api/access/activity' && request.method==='GET') {
    requireCapability(context,'access.audit.view')
    return response(await listActivity(env.DB,context.businessId,Object.fromEntries(url.searchParams)))
  }
  if(url.pathname==='/api/access/users') {
    if(request.method==='GET') return response(await listUsers(env.DB,context))
    if(request.method==='POST') {
      assertSameOriginMutation(request)
      requireCapability(context,'access.users.manage')
      return response(await createUser(env.DB,context,await readJson(request),new Date(),{env}),{status:201})
    }
  }
  const userMatch=url.pathname.match(/^\/api\/access\/users\/([^/]+)$/)
  if(userMatch && request.method==='PATCH') {
    assertSameOriginMutation(request)
    requireCapability(context,'access.users.manage')
    return response(await updateUser(env.DB,context,decodeURIComponent(userMatch[1]),await readJson(request)))
  }
  const resetMatch=url.pathname.match(/^\/api\/access\/users\/([^/]+)\/(reset|resend-invite)$/)
  if(resetMatch && request.method==='POST') {
    assertSameOriginMutation(request)
    return response(await (resetMatch[2]==='reset'?requestCredentialReset:resendInvitation)(env.DB,context,decodeURIComponent(resetMatch[1]),new Date(),{env}))
  }
  if(url.pathname==='/api/access/me/password' && request.method==='POST') {
    assertSameOriginMutation(request)
    const session=await changeOwnPassword(env.DB,context,await readJson(request))
    const cookie=context.accountId
      ? (session.token ? accountSessionCookie(session.token,session.expiresAt) : clearAccountSessionCookie())
      : sessionCookie(session.token,SESSION_DURATIONS[context.deviceMode])
    return response({changed:true,expiresAt:session.expiresAt ?? null},{headers:{'set-cookie':cookie}})
  }
  return null
}
