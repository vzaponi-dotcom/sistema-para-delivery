const SELECT_ACCESS = `SELECT business_id, pairing_token_hash, pairing_expires_at,
  session_token_hash, session_issued_at, paired_at, last_seen_at, revoked_at,
  created_at, updated_at
  FROM kitchen_tv_access`

const mapAccess = (row) => row ? {
  businessId: row.business_id,
  pairingTokenHash: row.pairing_token_hash,
  pairingExpiresAt: row.pairing_expires_at,
  sessionTokenHash: row.session_token_hash,
  sessionIssuedAt: row.session_issued_at,
  pairedAt: row.paired_at,
  lastSeenAt: row.last_seen_at,
  revokedAt: row.revoked_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
} : null

export async function loadKitchenTvAccess(db, businessId) {
  return mapAccess(await db.prepare(`${SELECT_ACCESS} WHERE business_id = ?`).bind(businessId).first())
}

export async function issueKitchenTvPairing(db, businessId, pairingHash, expiresAt, now = new Date()) {
  const issuedAt = now.toISOString()
  await db.prepare(`INSERT INTO kitchen_tv_access (
      business_id, pairing_token_hash, pairing_expires_at, session_token_hash,
      session_issued_at, paired_at, last_seen_at, revoked_at, created_at, updated_at
    ) VALUES (?, ?, ?, NULL, NULL, NULL, NULL, NULL, ?, ?)
    ON CONFLICT(business_id) DO UPDATE SET
      pairing_token_hash = excluded.pairing_token_hash,
      pairing_expires_at = excluded.pairing_expires_at,
      session_token_hash = NULL,
      session_issued_at = NULL,
      paired_at = NULL,
      last_seen_at = NULL,
      revoked_at = NULL,
      updated_at = excluded.updated_at`)
    .bind(businessId, pairingHash, expiresAt.toISOString(), issuedAt, issuedAt)
    .run()
  return loadKitchenTvAccess(db, businessId)
}

export async function consumeKitchenTvPairing(db, pairingHash, sessionHash, now = new Date()) {
  const pairedAt = now.toISOString()
  const row = await db.prepare(`UPDATE kitchen_tv_access SET
      pairing_token_hash = NULL,
      pairing_expires_at = NULL,
      session_token_hash = ?,
      session_issued_at = ?,
      paired_at = ?,
      last_seen_at = ?,
      revoked_at = NULL,
      updated_at = ?
    WHERE pairing_token_hash = ? AND pairing_expires_at > ?
    RETURNING business_id, pairing_token_hash, pairing_expires_at,
      session_token_hash, session_issued_at, paired_at, last_seen_at, revoked_at,
      created_at, updated_at`)
    .bind(sessionHash, pairedAt, pairedAt, pairedAt, pairedAt, pairingHash, pairedAt)
    .first()
  return mapAccess(row)
}

export async function loadKitchenTvSessionByHash(db, sessionHash, businessId) {
  const businessClause = businessId === undefined ? '' : ' AND business_id = ?'
  const statement = db.prepare(`${SELECT_ACCESS}
    WHERE session_token_hash = ? AND revoked_at IS NULL${businessClause}`)
  const row = businessId === undefined
    ? await statement.bind(sessionHash).first()
    : await statement.bind(sessionHash, businessId).first()
  return mapAccess(row)
}

export async function touchKitchenTvSession(db, businessId, now = new Date(), minIntervalMs = 300_000) {
  const seenAt = now.toISOString()
  const threshold = new Date(now.getTime() - minIntervalMs).toISOString()
  const result = await db.prepare(`UPDATE kitchen_tv_access
    SET last_seen_at = ?, updated_at = ?
    WHERE business_id = ? AND session_token_hash IS NOT NULL AND revoked_at IS NULL
      AND (last_seen_at IS NULL OR last_seen_at <= ?)`)
    .bind(seenAt, seenAt, businessId, threshold)
    .run()
  return Number(result?.meta?.changes ?? 0) > 0
}

export async function revokeKitchenTvAccess(db, businessId, now = new Date()) {
  const revokedAt = now.toISOString()
  await db.prepare(`UPDATE kitchen_tv_access SET
      pairing_token_hash = NULL,
      pairing_expires_at = NULL,
      session_token_hash = NULL,
      session_issued_at = NULL,
      revoked_at = ?,
      updated_at = ?
    WHERE business_id = ?`)
    .bind(revokedAt, revokedAt, businessId)
    .run()
  return loadKitchenTvAccess(db, businessId)
}
