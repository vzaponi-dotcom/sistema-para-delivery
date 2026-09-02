from pathlib import Path

path = Path('worker/repositories.js')
source = path.read_text()
old = """export const deleteOrder = async (db, businessId, id) => {
  const existing = await db.prepare('SELECT id FROM orders WHERE id = ? AND business_id = ? LIMIT 1').bind(id, businessId).first()
  if (!existing) return false
  await db.batch([
    db.prepare(\"DELETE FROM movements WHERE business_id = ? AND order_id = ? AND source = 'order-payment'\").bind(businessId, id),
    db.prepare('DELETE FROM orders WHERE id = ? AND business_id = ?').bind(id, businessId),
  ])
  return true
}
"""
new = """export const deleteOrder = async (db, businessId, id) => {
  const existing = await db.prepare('SELECT id, table_tab_id FROM orders WHERE id = ? AND business_id = ? LIMIT 1').bind(id, businessId).first()
  if (!existing) return false
  await db.batch([
    db.prepare(\"DELETE FROM movements WHERE business_id = ? AND order_id = ? AND source = 'order-payment'\").bind(businessId, id),
    db.prepare('DELETE FROM orders WHERE id = ? AND business_id = ?').bind(id, businessId),
  ])
  await closeTableTabIfSettled(db, businessId, existing.table_tab_id)
  return true
}
"""
count = source.count(old)
if count != 1:
    raise SystemExit(f'Expected one deleteOrder block, found {count}')
path.write_text(source.replace(old, new, 1))
