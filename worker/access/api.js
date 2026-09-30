import { assertSameOriginMutation, json, readJson } from '../http.js'
import { sessionCookie } from '../auth.js'
import { requireCapability } from '../settingsAccess.js'
import { SESSION_DURATIONS } from './sessions.js'
import { listUsers, createUser, updateUser, requestCredentialReset, changeOwnPassword } from './users.js'

const response=(data,init={})=>json(data,{...init,headers:{'cache-control':'no-store',...init.headers}})
export async function handleAccessApi(request,env,context,url) {
  if(url.pathname==='/api/access/users') {
    if(request.method==='GET') return response(await listUsers(env.DB,context))
    if(request.method==='POST') {
      assertSameOriginMutation(request)
      requireCapability(context,'access.users.manage')
      return response(await createUser(env.DB,context,await readJson(request)),{status:201})
    }
  }
  const userMatch=url.pathname.match(/^\/api\/access\/users\/([^/]+)$/)
  if(userMatch && request.method==='PATCH') {
    assertSameOriginMutation(request)
    requireCapability(context,'access.users.manage')
    return response(await updateUser(env.DB,context,decodeURIComponent(userMatch[1]),await readJson(request)))
  }
  const resetMatch=url.pathname.match(/^\/api\/access\/users\/([^/]+)\/reset$/)
  if(resetMatch && request.method==='POST') {
    assertSameOriginMutation(request)
    return response(await requestCredentialReset(env.DB,context,decodeURIComponent(resetMatch[1])))
  }
  if(url.pathname==='/api/access/me/password' && request.method==='POST') {
    assertSameOriginMutation(request)
    const session=await changeOwnPassword(env.DB,context,await readJson(request))
    return response({changed:true,expiresAt:session.expiresAt},{headers:{'set-cookie':sessionCookie(session.token,SESSION_DURATIONS[context.deviceMode])}})
  }
  return null
}
