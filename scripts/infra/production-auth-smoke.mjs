const json = async response => {
  try { return await response.json() } catch { return null }
}

const sameOriginPost = (baseUrl, body) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: baseUrl },
  body: JSON.stringify(body),
})

export async function verifyProductionAuth({
  baseUrl,
  phase,
  pin = '',
  attempts = 12,
  fetchImpl = fetch,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  log = console.log,
}) {
  if (!['legacy', 'prepare', 'multi_company'].includes(phase)) throw new Error('Unknown production auth phase.')
  const origin = new URL(baseUrl).origin
  if (origin !== baseUrl) throw new Error('Production URL must be an origin.')
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 20) throw new Error('Invalid production readiness attempts.')

  let session
  let lastReason = 'network unavailable'
  let ready = false

  for (let attempt = 1; attempt <= attempts; attempt++) {
    let sessionResponse
    try {
      sessionResponse = await fetchImpl(`${baseUrl}/api/auth/session`, { cache: 'no-store' })
    } catch {
      sessionResponse = null
    }

    if (!sessionResponse?.ok) {
      lastReason = sessionResponse ? `HTTP ${sessionResponse.status}` : 'network unavailable'
    } else {
      session = await json(sessionResponse)
      if (phase === 'multi_company') {
        ready = session?.authMode === 'multi_company' && session?.authenticated === false
        lastReason = ready ? '' : 'Production did not expose the expected anonymous multi-company session.'
      } else if (phase === 'prepare') {
        ready = true
        for (const path of ['/api/auth/email-challenges/inspect', '/api/auth/company-invitations/inspect']) {
          let response
          try {
            response = await fetchImpl(`${baseUrl}${path}`, sameOriginPost(baseUrl, { token: 'synthetic-invalid-token' }))
          } catch {
            response = null
          }
          if (!response || response.status === 404 || response.status >= 500) {
            ready = false
            lastReason = response ? `Prepare endpoint unavailable: ${path} HTTP ${response.status}` : `Prepare endpoint unavailable: ${path}`
            break
          }
        }
      } else {
        ready = true
      }
    }

    if (ready) {
      log(`Production ready on attempt ${attempt}/${attempts} for phase ${phase}.`)
      break
    }
    log(`Production readiness attempt ${attempt}/${attempts}: ${lastReason}`)
    if (attempt < attempts) await sleep(5000)
  }

  if (!ready) throw new Error(`Production did not become ready within the bounded propagation window: ${lastReason}`)

  if (phase === 'multi_company') {
    const pinResponse = await fetchImpl(`${baseUrl}/api/auth/login`, sameOriginPost(baseUrl, { pin: pin || 'legacy-pin-must-not-work' }))
    if (pinResponse.ok) throw new Error('Legacy PIN login remained available after multi-company cutover.')
    log(`Production multi-company anonymous session OK; legacy PIN rejected with HTTP ${pinResponse.status}.`)
    return { phase, authMode: session.authMode, pinRejected: true }
  }

  if (phase === 'prepare') {
    if (!pin) throw new Error('Production prepare phase requires the current legacy PIN for continuity verification.')
    const pinResponse = await fetchImpl(`${baseUrl}/api/auth/login`, sameOriginPost(baseUrl, { pin }))
    if (!pinResponse.ok) throw new Error(`Legacy PIN continuity failed during prepare phase: HTTP ${pinResponse.status}`)
    log('Production prepare phase kept legacy PIN access and exposed only the preparation endpoints.')
    return { phase, legacyLogin: true, prepareEndpoints: true }
  }

  if (pin) {
    const pinResponse = await fetchImpl(`${baseUrl}/api/auth/login`, sameOriginPost(baseUrl, { pin }))
    if (!pinResponse.ok) throw new Error(`Legacy production PIN login failed: HTTP ${pinResponse.status}`)
  }
  log('Production legacy auth smoke completed.')
  return { phase, legacyLogin: Boolean(pin) }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  verifyProductionAuth({
    baseUrl: process.env.PRODUCTION_URL,
    phase: process.env.PRODUCTION_AUTH_PHASE,
    pin: process.env.AMOR_PIN || '',
    attempts: Number(process.env.PRODUCTION_READY_ATTEMPTS || 12),
  }).catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
}
