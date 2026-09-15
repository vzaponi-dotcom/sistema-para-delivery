export const SETTINGS_RECEIPT_TTL_MS = 24 * 60 * 60 * 1000
export const settingsError = (code, status, extra = {}) => Object.assign(new Error(code), { code, status, ...extra })

function canonical(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return `[${Array.from(value, canonical).join(',')}]`
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  }
  throw settingsError('SETTINGS_INVALID', 400)
}

export async function hashSettingsPayload(input) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(input)))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

// predicateSql is exclusively internal repository SQL. Client values belong in bindings.
// CASE always inserts a row, including false/null; the SQL trigger aborts the batch.
export function prepareSettingsAssertion(db, txId, checkKey, predicateSql, bindings = []) {
  return db.prepare(`INSERT INTO settings_tx_assertions (tx_id, check_key, valid)
    SELECT ?, ?, CASE WHEN (${predicateSql}) THEN 1 ELSE 0 END`).bind(txId, checkKey, ...bindings)
}

export function clearSettingsAssertions(db, txId) {
  return db.prepare('DELETE FROM settings_tx_assertions WHERE tx_id = ?').bind(txId)
}

// Caller must authenticate/authorize business/resource before consulting receipts.
// null means no confirmation currently found; it never proves rollback.
export async function readSettingsReceipt(db, businessId, resourceKey, mutationId, now = new Date()) {
  let row
  try {
    row = await db.prepare(`SELECT payload_hash, committed_revision, committed_at,
      resource_created_at, resource_updated_at FROM settings_mutation_receipts
      WHERE business_id = ? AND resource_key = ? AND mutation_id = ?`).bind(businessId, resourceKey, mutationId).first()
  } catch (cause) { throw settingsError('SETTINGS_UNAVAILABLE', 503, { cause }) }
  if (!row) return null
  const committedTime = Date.parse(row.committed_at)
  if (!row.payload_hash || !Number.isSafeInteger(row.committed_revision) || row.committed_revision < 1 || !Number.isFinite(committedTime)) {
    throw settingsError('SETTINGS_UNAVAILABLE', 503)
  }
  if (+now - committedTime >= SETTINGS_RECEIPT_TTL_MS) {
    throw settingsError('SETTINGS_REVISION_CONFLICT', 409, { reason: 'receipt_expired' })
  }
  return { mutationId, payloadHash: row.payload_hash, committedRevision: row.committed_revision,
    committedAt: row.committed_at, resourceCreatedAt: row.resource_created_at, resourceUpdatedAt: row.resource_updated_at }
}
