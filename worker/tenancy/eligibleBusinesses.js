export async function listEligibleBusinesses(db, accountId) {
  const { results } = await db.prepare(`SELECT b.id AS businessId,b.name,r.name AS roleName,
    CASE WHEN bp.logo_object_key IS NOT NULL THEN 1 ELSE 0 END AS hasLogo,
    CASE WHEN bp.logo_object_key IS NOT NULL THEN bp.logo_updated_at ELSE NULL END AS logoVersion
    FROM users u
    JOIN businesses b ON b.id = u.business_id
    JOIN roles r ON r.business_id = u.business_id AND r.id = u.role_id
    LEFT JOIN business_profiles bp ON bp.business_id = b.id
    WHERE u.account_id = ? AND u.active = 1 AND u.membership_state = 'active' AND b.access_status = 'active' AND b.lifecycle_status = 'enabled'
    AND r.active = 1 ORDER BY b.name,b.id`).bind(accountId).all()
  return results.map((row) => ({
    businessId: row.businessId,
    name: row.name,
    roleName: row.roleName,
    hasLogo: Boolean(row.hasLogo),
    logoVersion: row.hasLogo ? (row.logoVersion ?? null) : null,
  }))
}

export async function loadEligibleBusinessLogo(db, accountId, businessId) {
  if (typeof businessId !== 'string' || !businessId.trim()) return null
  return db.prepare(`SELECT bp.logo_object_key AS objectKey,bp.logo_content_type AS contentType
    FROM users u
    JOIN businesses b ON b.id = u.business_id
    JOIN roles r ON r.business_id = u.business_id AND r.id = u.role_id
    JOIN business_profiles bp ON bp.business_id = b.id
    WHERE u.account_id = ? AND u.business_id = ? AND u.active = 1 AND u.membership_state = 'active'
    AND b.access_status = 'active' AND b.lifecycle_status = 'enabled' AND r.active = 1 AND bp.logo_object_key IS NOT NULL
    LIMIT 1`).bind(accountId, businessId.trim()).first()
}
