import { sha256Hex } from '../auth.js'
import { apiError } from '../http.js'
import { normalizeAccessEmail } from '../../shared/accessEmail.js'

const cleanup = (db,table,now) => db.prepare(`DELETE FROM ${table} WHERE id IN (SELECT id FROM ${table} WHERE created_at<? ORDER BY created_at,id LIMIT 100)`)
  .bind(new Date(now.getTime()-2*24*60*60*1000).toISOString())

export async function reserveRecoveryRequest(db,{businessId,email,originKey,now=new Date()}) {
  const normalized = normalizeAccessEmail(email)
  const [account,origin] = await Promise.all([sha256Hex(`${businessId}\nemail-recovery-account\n${normalized}`),sha256Hex(`${businessId}\nemail-recovery-origin\n${originKey}`)])
  const accountSince = new Date(now.getTime()-30*60*1000).toISOString()
  const originSince = new Date(now.getTime()-15*60*1000).toISOString()
  const [result] = await db.batch([
    db.prepare(`INSERT INTO auth_email_requests(id,business_id,account_key,origin_key,created_at)
      SELECT ?,?,?,?,? WHERE
      (SELECT count(*) FROM auth_email_requests WHERE business_id=? AND account_key=? AND created_at>?)<3
      AND (SELECT count(*) FROM auth_email_requests WHERE business_id=? AND origin_key=? AND created_at>?)<10`)
      .bind(crypto.randomUUID(),businessId,account,origin,now.toISOString(),businessId,account,accountSince,businessId,origin,originSince),
    cleanup(db,'auth_email_requests',now),
  ])
  const allowed = result.meta?.changes===1
  return {allowed,retryAfterSeconds:allowed ? 0 : 30*60}
}

export function prepareEmailDeliveryReservation(db,{businessId,userId,challengeId,now=new Date(),dailyLimit=80,cooldownSeconds=60,required=false}) {
  if (!Number.isSafeInteger(dailyLimit) || dailyLimit<1 || !Number.isSafeInteger(cooldownSeconds) || cooldownSeconds<0) throw apiError(503,'EMAIL_CONFIG_UNAVAILABLE','Envio de e-mail indisponível. Tente novamente mais tarde.')
  const day = `${now.toISOString().slice(0,10)}T00:00:00.000Z`
  const since = new Date(now.getTime()-cooldownSeconds*1000).toISOString()
  const predicate=`NOT EXISTS (SELECT 1 FROM auth_email_deliveries WHERE id=?)
      AND (SELECT count(*) FROM auth_email_deliveries WHERE created_at>=?)<?
      AND (?=0 OR NOT EXISTS (SELECT 1 FROM auth_email_deliveries WHERE business_id=? AND user_id=? AND created_at>?))`
  const values=[challengeId,day,dailyLimit,cooldownSeconds,businessId,userId,since]
  return required
    ? db.prepare(`INSERT INTO auth_email_deliveries(id,business_id,user_id,created_at) VALUES (?,?,?,CASE WHEN ${predicate} THEN ? ELSE NULL END)`)
      .bind(challengeId,businessId,userId,...values,now.toISOString())
    : db.prepare(`INSERT INTO auth_email_deliveries(id,business_id,user_id,created_at) SELECT ?,?,?,? WHERE ${predicate}`)
      .bind(challengeId,businessId,userId,now.toISOString(),...values)
}
export async function reserveEmailDelivery(db,{now=new Date(),...options}) {
  const [result] = await db.batch([
    prepareEmailDeliveryReservation(db,{...options,now}),
    cleanup(db,'auth_email_deliveries',now),
  ])
  const allowed = result.meta?.changes===1
  return {allowed,reason:allowed ? null : 'limited'}
}
