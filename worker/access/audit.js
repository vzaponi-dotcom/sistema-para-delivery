// Narrow seed for security events; Task 8 composes business events here.
export function prepareSecurityEvent(db, { businessId, action, result, context = null, metadata = {}, now = new Date() }) {
  const safe = {}
  if (['shared','personal'].includes(metadata.deviceMode)) safe.deviceMode = metadata.deviceMode
  if (['legacy','enrollment','user_only'].includes(metadata.authMode)) safe.authMode = metadata.authMode
  const actorType = context?.userId ? 'user' : context?.legacy ? 'legacy' : 'system'
  return db.prepare(`INSERT INTO audit_events
    (id,business_id,occurred_at,actor_type,actor_user_id,actor_name,session_id,action,result,metadata_json)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), businessId, now.toISOString(), actorType,
      context?.userId || null, context?.displayName || 'Sistema', context?.sessionId || null, action, result, JSON.stringify(safe))
}
export async function recordSecurityEvent(db, options) {
  await prepareSecurityEvent(db, options).run()
}
