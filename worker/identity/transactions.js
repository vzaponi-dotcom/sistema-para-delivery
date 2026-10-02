export function prepareIdentityAssertion(db, id, selectSql, values = []) {
  return db.prepare(`INSERT INTO identity_tx_assertions(id,ok) VALUES (?,COALESCE((${selectSql}),0))`).bind(id, ...values)
}

export async function commitIdentityStatements(db, statements) {
  // Guards are transient and are removed in the same transaction as their writes.
  return db.batch([...statements, db.prepare('DELETE FROM identity_tx_assertions')])
}
