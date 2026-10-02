import { normalizeAccessEmail } from '../../shared/accessEmail.js'
import { verifyHumanPassword } from '../access/credentials.js'
import { apiError } from '../http.js'

const DUMMY_VERIFIER = 'v1$pbkdf2-sha256$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='

export function findAccountByEmail(db, email) {
  return db.prepare('SELECT * FROM accounts WHERE email_normalized = ?').bind(normalizeAccessEmail(email)).first()
}

export function prepareAccountCreation(db, { id = crypto.randomUUID(), email, displayName, now = new Date() }) {
  email = normalizeAccessEmail(email)
  if (typeof displayName !== 'string' || !displayName.trim() || Array.from(displayName.trim()).length > 200) throw apiError(400, 'INVALID_ACCOUNT_NAME', 'Informe um nome com até 200 caracteres.')
  return { statements: [db.prepare(`INSERT INTO accounts(id,email_normalized,display_name,created_at,updated_at)
    VALUES (?,?,?,?,?) ON CONFLICT(email_normalized) DO NOTHING`).bind(id, email, displayName.trim(), now.toISOString(), now.toISOString())], value: { id, email } }
}

export async function verifyAccountLogin(db, { email, password }, { verify = verifyHumanPassword } = {}) {
  let normalized = ''
  try { normalized = normalizeAccessEmail(email) } catch { /* Invalid input uses the same absent-account derivation. */ }
  const account = await db.prepare(`SELECT a.*,c.password_verifier,c.revision AS credential_revision FROM accounts a
    JOIN account_credentials c ON c.account_id = a.id AND c.version = 1
    WHERE a.email_normalized = ? AND a.active = 1 AND a.email_verified_at IS NOT NULL`).bind(normalized).first()
  const verified = await verify(typeof password === 'string' ? password : '', account?.password_verifier || DUMMY_VERIFIER)
  return account && verified ? account : null
}
