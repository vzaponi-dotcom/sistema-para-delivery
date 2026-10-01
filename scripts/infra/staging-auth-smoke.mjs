import { fileURLToPath } from 'node:url'
import path from 'node:path'

export function stagingPinSql(verifier) {
  if (!verifier) throw new Error('Staging PIN verifier was not generated.')
  const escaped = verifier.replaceAll("'", "''")
  return `INSERT INTO auth_credentials (business_id, pin_hash, created_at, updated_at)
SELECT 'amor-e-sabor', '${escaped}', datetime('now'), datetime('now')
WHERE EXISTS (SELECT 1 FROM business_auth_state WHERE business_id='amor-e-sabor' AND mode IN ('legacy','enrollment'))
ON CONFLICT(business_id) DO UPDATE SET pin_hash=excluded.pin_hash, updated_at=excluded.updated_at;
`
}

const ensure = (condition, message) => { if (!condition) throw new Error(message) }
const anonymous = (body) => body?.authenticated === false
  && ['legacy', 'enrollment', 'user_only'].includes(body.authMode)
  && Object.keys(body).every(key => ['authenticated', 'authMode'].includes(key))

export async function verifyStagingAuth({ baseUrl, pin, attempts = 6, fetchImpl = fetch,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), log = console.log } = {}) {
  const origin = new URL(baseUrl).origin
  ensure(Number.isInteger(attempts) && attempts > 0 && attempts <= 20, 'Invalid staging readiness attempts.')
  const call = (route, options = {}) => fetchImpl(`${origin}${route}`, { cache: 'no-store', redirect: 'manual', ...options })
  let session
  let lastReason
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let response
    try { response = await call('/api/auth/session') } catch { /* Bounded propagation retry only. */ }
    lastReason = response ? `HTTP ${response.status}` : 'network unavailable'
    if (response?.ok) {
      lastReason = 'Anonymous session must be uncached and must not issue a cookie.'
      if (response.headers.get('cache-control')?.includes('no-store') && !response.headers.get('set-cookie')) {
        let candidate
        try { candidate = await response.json() } catch { /* Old/malformed wire contract is not ready. */ }
        lastReason = 'Anonymous session must expose only a known auth mode and no identity.'
        if (anonymous(candidate)) {
          session = candidate
          log(`Staging ready on attempt ${attempt}/${attempts}; auth mode ${session.authMode}`)
          break
        }
      }
    }
    log(`Staging readiness attempt ${attempt}/${attempts}: ${lastReason}`)
    if (attempt < attempts) await sleep(5000)
  }
  ensure(session, `Staging did not become ready within the bounded propagation window: ${lastReason}`)

  const bootstrap = await call('/api/bootstrap')
  ensure(bootstrap.status === 401 && !bootstrap.headers.get('set-cookie') && (await bootstrap.json()).error?.code === 'UNAUTHENTICATED', 'Anonymous bootstrap must be denied.')
  const post = (headers, body) => call('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })
  const crossOrigin = await post({ origin: 'https://invalid-staging-origin.example' }, {})
  ensure(crossOrigin.status === 403 && !crossOrigin.headers.get('set-cookie') && (await crossOrigin.json()).error?.code === 'ORIGIN_NOT_ALLOWED', 'Login must reject a foreign origin.')

  if (session.authMode !== 'user_only') ensure(pin, 'STAGING_PIN is required for legacy/enrollment smoke.')
  const login = await post({ origin }, { pin: pin || 'staging-disabled-pin-probe' })
  const loginBody = await login.json()
  if (session.authMode === 'user_only') {
    const denied = login.status === 401 && loginBody.error?.code === 'INVALID_LOGIN'
      || login.status === 429 && loginBody.error?.code === 'LOGIN_RATE_LIMITED'
    ensure(denied && !login.headers.get('set-cookie') && loginBody.authenticated !== true, 'user_only PIN rejection must not create a session.')
    const after = await call('/api/auth/session')
    ensure(after.ok && anonymous(await after.json()), 'Anonymous session must remain anonymous after PIN rejection.')
    log(`Staging user_only PIN rejection HTTP ${login.status}; anonymous boundaries OK`)
  } else {
    const setCookie = login.headers.get('set-cookie') || ''
    ensure(login.ok && loginBody.authenticated === true && /^amor_session=[A-Za-z0-9_-]{43};/.test(setCookie), 'Staging PIN login failed or did not issue a session.')
    const cookie = setCookie.split(';')[0]
    const authenticated = await call('/api/auth/session', { headers: { cookie } })
    const current = await authenticated.json()
    ensure(authenticated.ok && current.authenticated === true && current.authMode === session.authMode && current.user === null, 'PIN session discovery must confirm the current legacy identity.')
    const logout = await call('/api/auth/logout', { method: 'POST', headers: { origin, cookie } })
    ensure(logout.ok && (await logout.json()).authenticated === false, 'Staging PIN smoke logout failed.')
    const revoked = await call('/api/auth/session', { headers: { cookie } })
    ensure(revoked.ok && anonymous(await revoked.json()), 'Staging PIN smoke session was not revoked.')
    log(`Staging ${session.authMode} PIN login and logout OK; anonymous boundaries OK`)
  }
  return { authMode: session.authMode }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    await verifyStagingAuth({ baseUrl: process.env.STAGING_URL, pin: process.env.STAGING_PIN, attempts: Number(process.env.STAGING_READY_ATTEMPTS || 6) })
  } catch (error) {
    console.error(`Staging authentication smoke failed: ${error.message}`)
    process.exitCode = 1
  }
}
