const SELECT_ACCESS = `SELECT business_id, pairing_token_hash, pairing_expires_at,
  session_token_hash, session_issued_at, paired_at, last_seen_at, revoked_at,
  created_at, updated_at
  FROM kitchen_tv_access`

const SELECT_PAIRING_REQUEST = `SELECT request_token_hash, pairing_code, approved_business_id,
  expires_at, created_at, approved_at, consumed_at
  FROM kitchen_tv_pairing_requests`

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

const mapPairingRequest = (row) => row ? {
  requestTokenHash: row.request_token_hash,
  pairingCode: row.pairing_code,
  approvedBusinessId: row.approved_business_id,
  expiresAt: row.expires_at,
  createdAt: row.created_at,
  approvedAt: row.approved_at,
  consumedAt: row.consumed_at,
} : null

export async function loadKitchenTvAccess(db, businessId) {
  return mapAccess(await db.prepare(`${SELECT_ACCESS} WHERE business_id = ?`).bind(businessId).first())
}

export async function createKitchenTvPairingRequest(db, requestHash, code, expiresAt, now = new Date()) {
  const createdAt = now.toISOString()
  await db.prepare('DELETE FROM kitchen_tv_pairing_requests WHERE expires_at <= ? OR consumed_at IS NOT NULL')
    .bind(createdAt)
    .run()
  await db.prepare(`INSERT INTO kitchen_tv_pairing_requests
    (request_token_hash, pairing_code, approved_business_id, expires_at, created_at, approved_at, consumed_at)
    VALUES (?, ?, NULL, ?, ?, NULL, NULL)`)
    .bind(requestHash, code, expiresAt.toISOString(), createdAt)
    .run()
  return loadKitchenTvPairingRequestByHash(db, requestHash)
}

export async function loadKitchenTvPairingRequestByHash(db, requestHash) {
  return mapPairingRequest(await db.prepare(`${SELECT_PAIRING_REQUEST} WHERE request_token_hash = ?`).bind(requestHash).first())
}

export async function loadKitchenTvPendingApproval(db, businessId, now = new Date()) {
  return mapPairingRequest(await db.prepare(`${SELECT_PAIRING_REQUEST}
    WHERE approved_business_id = ? AND consumed_at IS NULL AND expires_at > ?
    ORDER BY approved_at DESC LIMIT 1`)
    .bind(businessId, now.toISOString())
    .first())
}

export async function approveKitchenTvPairingCode(db, code, businessId, now = new Date()) {
  const approvedAt = now.toISOString()
  const results = await db.batch([
    db.prepare(`UPDATE kitchen_tv_pairing_requests
      SET consumed_at = ?
      WHERE approved_business_id = ? AND consumed_at IS NULL`)
      .bind(approvedAt, businessId),
    db.prepare(`UPDATE kitchen_tv_pairing_requests
      SET approved_business_id = ?, approved_at = ?
      WHERE pairing_code = ? AND approved_business_id IS NULL
        AND consumed_at IS NULL AND expires_at > ?
      RETURNING request_token_hash, pairing_code, approved_business_id,
        expires_at, created_at, approved_at, consumed_at`)
      .bind(businessId, approvedAt, code, approvedAt),
  ])
  return mapPairingRequest(results?.[1]?.results?.[0])
}

export async function activateKitchenTvApprovedRequest(db, requestHash, sessionHash, now = new Date()) {
  const pairedAt = now.toISOString()
  const results = await db.batch([
    db.prepare(`UPDATE kitchen_tv_pairing_requests
      SET consumed_at = ?
      WHERE request_token_hash = ? AND approved_business_id IS NOT NULL
        AND consumed_at IS NULL AND expires_at > ?
      RETURNING approved_business_id`)
      .bind(pairedAt, requestHash, pairedAt),
    db.prepare(`INSERT INTO kitchen_tv_access (
        business_id, pairing_token_hash, pairing_expires_at, session_token_hash,
        session_issued_at, paired_at, last_seen_at, revoked_at, created_at, updated_at
      )
      SELECT approved_business_id, NULL, NULL, ?, ?, ?, ?, NULL, ?, ?
      FROM kitchen_tv_pairing_requests
      WHERE request_token_hash = ? AND consumed_at = ?
      ON CONFLICT(business_id) DO UPDATE SET
        pairing_token_hash = NULL,
        pairing_expires_at = NULL,
        session_token_hash = excluded.session_token_hash,
        session_issued_at = excluded.session_issued_at,
        paired_at = excluded.paired_at,
        last_seen_at = excluded.last_seen_at,
        revoked_at = NULL,
        updated_at = excluded.updated_at`)
      .bind(sessionHash, pairedAt, pairedAt, pairedAt, pairedAt, pairedAt, requestHash, pairedAt),
  ])
  const businessId = results?.[0]?.results?.[0]?.approved_business_id
  return businessId ? loadKitchenTvAccess(db, businessId) : null
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
  await db.batch([
    db.prepare(`UPDATE kitchen_tv_access SET
        pairing_token_hash = NULL,
        pairing_expires_at = NULL,
        session_token_hash = NULL,
        session_issued_at = NULL,
        revoked_at = ?,
        updated_at = ?
      WHERE business_id = ?`)
      .bind(revokedAt, revokedAt, businessId),
    db.prepare(`UPDATE kitchen_tv_pairing_requests
      SET consumed_at = ?
      WHERE approved_business_id = ? AND consumed_at IS NULL`)
      .bind(revokedAt, businessId),
  ])
  return loadKitchenTvAccess(db, businessId)
}
