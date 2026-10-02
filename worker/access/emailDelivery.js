import { apiError } from '../http.js'
import { normalizeAccessEmail } from '../../shared/accessEmail.js'
import { buildChallengeEmail } from './emailTemplates.js'
import { prepareAuditEvent } from './audit.js'

export const unavailableEmailConfig = () => apiError(503,'EMAIL_CONFIG_UNAVAILABLE','Envio de e-mail indisponível. Tente novamente mais tarde.')

export function readEmailConfig(env) {
  try {
    if (![env.AUTH_EMAIL_ENABLED,env.AUTH_MULTI_COMPANY_ENABLED,env.AUTH_MULTI_COMPANY_PREPARE_ENABLED].some(value=>value==='true' || value===true)) throw unavailableEmailConfig()
    const apiKey = env.RESEND_API_KEY, from = env.AUTH_EMAIL_FROM, publicOrigin = env.AUTH_PUBLIC_ORIGIN
    if (typeof apiKey!=='string' || !apiKey || /\s/.test(apiKey) || typeof from!=='string' || [...from].some(char=>char.charCodeAt(0)<32 || char.charCodeAt(0)===127)) throw unavailableEmailConfig()
    const sender = from.match(/^[^<>]+ <([^<>]+)>$/)?.[1] || from
    normalizeAccessEmail(sender)
    const url = new URL(publicOrigin)
    if (url.protocol!=='https:' || url.origin!==publicOrigin || url.username || url.password) throw unavailableEmailConfig()
    const dailyLimit = env.AUTH_EMAIL_DAILY_LIMIT===undefined ? 80 : Number(env.AUTH_EMAIL_DAILY_LIMIT)
    if (!Number.isSafeInteger(dailyLimit) || dailyLimit<1) throw unavailableEmailConfig()
    return {enabled:true,from,publicOrigin,apiKey,dailyLimit}
  } catch { throw unavailableEmailConfig() }
}

export async function deliverEmailChallenge(env,challenge,{fetchImpl=fetch}={}) {
  const config = readEmailConfig(env)
  const path = challenge.purpose==='activation' ? '/ativar-conta' : challenge.purpose==='company_invitation' ? '/aceitar-convite' : '/redefinir-senha'
  const url = new URL(path,config.publicOrigin)
  url.hash = new URLSearchParams({token:challenge.token}).toString()
  const email = buildChallengeEmail({...challenge,link:url.href,isStaging:new URL(config.publicOrigin).hostname.startsWith('staging.')})
  const payload = JSON.stringify({from:config.from,to:[normalizeAccessEmail(challenge.email)],...email})
  const headers = {'content-type':'application/json',Authorization:`Bearer ${config.apiKey}`,'Idempotency-Key':`mesiva/auth/${challenge.challengeId}`}
  let uncertain = false
  for (let attempt=0;attempt<2;attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(),5000)
    try {
      // Pinned workerd supports manual/follow, but rejects error before I/O.
      // Manual keeps credentials at this origin; 3xx responses are rejected below.
      const response = await fetchImpl('https://api.resend.com/emails',{method:'POST',redirect:'manual',headers,body:payload,signal:controller.signal})
      if (response.ok) {
        let body
        try { body=await response.json() } catch { return {status:'accepted'} }
        // Only persist the provider's UUID, never an arbitrary upstream message.
        const providerId = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(body?.id || '') ? body.id : null
        return {status:'accepted',...(providerId ? {providerId} : {})}
      }
      if (response.status>=500) uncertain=true
      if (response.status!==429 && response.status<500) return {status:uncertain ? 'uncertain' : 'rejected'}
    } catch { uncertain=true }
    finally { clearTimeout(timer) }
  }
  return {status:uncertain ? 'uncertain' : 'rejected'}
}

// The challenge is already committed. Never roll back prior access on a send error.
export async function deliverPersistedChallenge(db,env,{businessId,userId:_userId,purpose,displayName,...challenge},{deliver=deliverEmailChallenge,now=new Date()}={}) {
  const business=await db.prepare('SELECT name FROM businesses WHERE id=?').bind(businessId).first()
  let result
  try { result=await deliver(env,{...challenge,purpose,displayName,businessName:business?.name}) }
  catch { result={status:'uncertain'} }
  const status=['accepted','rejected','uncertain'].includes(result?.status)?result.status:'uncertain'
  const providerId=typeof result?.providerId==='string' && /^[0-9a-f-]{36}$/i.test(result.providerId)?result.providerId:null
  await db.batch([
    db.prepare(`UPDATE auth_email_challenges SET delivery_status=?,provider_id=?,revoked_at=CASE WHEN ?='rejected' THEN COALESCE(revoked_at,?) ELSE revoked_at END WHERE business_id=? AND id=?`)
      .bind(status,providerId,status,now.toISOString(),businessId,challenge.challengeId),
    prepareAuditEvent(db,{businessId,actorType:'system'},{action:`access.email.${purpose}.delivery.${status}`,resourceType:'email_challenge',resourceId:challenge.challengeId,outcome:status==='accepted'?'success':'failure',now}),
  ])
  return {status,expiresAt:challenge.expiresAt}
}
