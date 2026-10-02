import { apiError, assertSameOriginMutation, json, readJson, handleError } from '../http.js'
import { sessionCookie } from '../auth.js'
import { normalizeAccessEmail } from '../../shared/accessEmail.js'
import { verifyHumanPassword } from './credentials.js'
import { authenticateHumanRequest, createUserSession, loadAuthMode, SESSION_DURATIONS } from './sessions.js'
import { checkLoginThrottle, completeLoginAttempt } from './loginThrottle.js'
import { recordSecurityEvent } from './audit.js'
import { prepareEmailChallenge, commitEmailStatements, inspectEmailChallenge, completeEmailChallenge } from './emailChallenges.js'
import { reserveRecoveryRequest, reserveEmailDelivery } from './emailThrottle.js'
import { readEmailConfig, deliverEmailChallenge, deliverPersistedChallenge } from './emailDelivery.js'

export const RECOVERY_MESSAGE='Se houver uma conta ativa com esse e-mail, enviaremos um link para redefinir sua senha.'
const invalidLogin=()=>apiError(401,'INVALID_LOGIN','E-mail ou senha inválidos.')
const response=(data,init={})=>json(data,{...init,headers:{'cache-control':'no-store',...init.headers}})
const paths=new Set(['/api/auth/login','/api/auth/password-recovery','/api/auth/email-challenges/inspect','/api/auth/email-challenges/complete'])

export async function loginWithEmail(request,env,{businessId,body,validateSession}={}) {
  assertSameOriginMutation(request)
  body??=await readJson(request)
  const authMode=await loadAuthMode(env.DB,businessId)
  let email=''
  try { email=normalizeAccessEmail(body.email) } catch { /* All malformed identities share a failure bucket. */ }
  const deviceMode=body.deviceMode??'shared'
  if(!Object.hasOwn(SESSION_DURATIONS,deviceMode))throw apiError(400,'INVALID_DEVICE_MODE','Modo de dispositivo inválido.')
  const attempt=await checkLoginThrottle(env.DB,{businessId,normalizedLogin:email,originKey:request.headers.get('CF-Connecting-IP')||'unknown'})
  const event={businessId,metadata:{deviceMode,authMode}}
  if(!attempt.allowed){await recordSecurityEvent(env.DB,{...event,action:'login.blocked',result:'blocked'});throw apiError(429,'LOGIN_RATE_LIMITED','Muitas tentativas de acesso. Aguarde e tente novamente.')}
  const credential=await env.DB.prepare(`SELECT u.id,u.display_name,c.password_verifier FROM users u
    JOIN roles r ON r.business_id=u.business_id AND r.id=u.role_id AND r.active=1
    JOIN user_credentials c ON c.business_id=u.business_id AND c.user_id=u.id AND c.active=1
    WHERE u.business_id=? AND u.login_normalized=? AND u.active=1 AND u.email_verified_at IS NOT NULL`)
    .bind(businessId,email).first()
  const dummy='v1$pbkdf2-sha256$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
  const verified=await verifyHumanPassword(typeof body.password==='string'?body.password:'',credential?.password_verifier||dummy)
  if(!['enrollment','user_only'].includes(authMode)||!credential||!verified){await recordSecurityEvent(env.DB,{...event,action:'login.failure',result:'failure'});throw invalidLogin()}
  let session
  try { session=await createUserSession(env,{businessId,userId:credential.id,deviceMode,credentialVerifier:credential.password_verifier}) }
  catch(error){if(error.status===401)await recordSecurityEvent(env.DB,{...event,action:'login.failure',result:'failure'});throw error}
  const sessionRequest=new Request(request.url,{headers:{cookie:`amor_session=${session.token}`}})
  const context=await authenticateHumanRequest(sessionRequest,env)
  if(!context||context.businessId!==businessId)throw invalidLogin()
  await completeLoginAttempt(env.DB,attempt.attemptId,true)
  await recordSecurityEvent(env.DB,{...event,action:'login.success',result:'success',context:{userId:credential.id,displayName:credential.display_name,sessionId:session.sessionId}})
  const result=response({authenticated:true,businessId},{headers:{'set-cookie':sessionCookie(session.token,SESSION_DURATIONS[deviceMode])}})
  return validateSession?validateSession(sessionRequest,env,context,result):result
}

async function recover(request,env,businessId,body,fetchImpl) {
  const config=readEmailConfig(env),email=normalizeAccessEmail(body.email)
  const reservation=await reserveRecoveryRequest(env.DB,{businessId,email,originKey:request.headers.get('CF-Connecting-IP')||'unknown'})
  if(!reservation.allowed)throw apiError(429,'RECOVERY_RATE_LIMITED','Muitas solicitações. Aguarde antes de tentar novamente.')
  const user=await env.DB.prepare(`SELECT u.id,u.display_name,u.role_id,c.revision FROM users u
    JOIN roles r ON r.business_id=u.business_id AND r.id=u.role_id AND r.active=1
    JOIN user_credentials c ON c.business_id=u.business_id AND c.user_id=u.id AND c.active=1
    WHERE u.business_id=? AND u.login_normalized=? AND u.active=1 AND u.email_verified_at IS NOT NULL`).bind(businessId,email).first()
  if(user){
    const challengeId=crypto.randomUUID()
    const {statements,...prepared}=await prepareEmailChallenge(env.DB,{businessId,userId:user.id,purpose:'password_reset',challengeId,email,roleId:user.role_id,revision:user.revision})
    const quota=await reserveEmailDelivery(env.DB,{businessId,userId:user.id,challengeId,dailyLimit:config.dailyLimit,cooldownSeconds:0})
    if(quota.allowed){
      let challenge
      try { await commitEmailStatements(env.DB,statements);challenge=prepared }
      catch(error){if(error.code!=='INVALID_EMAIL_CHALLENGE')throw error}
      if(challenge)await deliverPersistedChallenge(env.DB,env,{...challenge,businessId,userId:user.id,purpose:'password_reset',displayName:user.display_name},{deliver:(deliveryEnv,data)=>deliverEmailChallenge(deliveryEnv,data,{fetchImpl})})
    }
  }
  return response({message:RECOVERY_MESSAGE})
}

export async function handleEmailAuthApi(request,env,{businessId,fetchImpl=fetch,validateSession}={}) {
  const path=new URL(request.url).pathname
  if(!paths.has(path)||request.method!=='POST')return null
  try {
    assertSameOriginMutation(request)
    const body=await readJson(request)
    if(path==='/api/auth/login')return await loginWithEmail(request,env,{businessId,body,validateSession})
    if(path==='/api/auth/password-recovery')return await recover(request,env,businessId,body,fetchImpl)
    const input={businessId,token:body.token}
    if(path.endsWith('/inspect'))return response(await inspectEmailChallenge(env.DB,input))
    return response(await completeEmailChallenge(env.DB,{...input,password:body.password}))
  } catch(error){const result=handleError(error);result.headers.set('cache-control','no-store');return result}
}
