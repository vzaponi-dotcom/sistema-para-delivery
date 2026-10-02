import { apiError } from '../http.js'
import { normalizeAccessEmail } from '../../shared/accessEmail.js'
import { buildChallengeEmail } from './emailTemplates.js'

export const unavailableEmailConfig = () => apiError(503,'EMAIL_CONFIG_UNAVAILABLE','Envio de e-mail indisponível. Tente novamente mais tarde.')

export function readEmailConfig(env) {
  try {
    if (env.AUTH_EMAIL_ENABLED!=='true' && env.AUTH_EMAIL_ENABLED!==true) throw unavailableEmailConfig()
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
  const path = challenge.purpose==='activation' ? '/ativar-conta' : '/redefinir-senha'
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
      const response = await fetchImpl('https://api.resend.com/emails',{method:'POST',redirect:'error',headers,body:payload,signal:controller.signal})
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
