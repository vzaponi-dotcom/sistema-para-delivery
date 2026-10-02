export async function listEligibleBusinesses(db, accountId) {
  const { results } = await db.prepare(`SELECT b.id AS businessId,b.name,r.name AS roleName FROM users u
    JOIN businesses b ON b.id = u.business_id JOIN roles r ON r.business_id = u.business_id AND r.id = u.role_id
    WHERE u.account_id = ? AND u.active = 1 AND u.membership_state = 'active' AND b.access_status = 'active'
    AND r.active = 1 ORDER BY b.name,b.id`).bind(accountId).all()
  return results
}
