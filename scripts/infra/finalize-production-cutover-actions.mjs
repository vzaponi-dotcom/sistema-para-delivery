import { appendFile } from 'node:fs/promises'
import { normalizeAccessEmail } from '../../shared/accessEmail.js'
import { runMultiCompanyProductionAdmin } from './multi-company-production-admin.mjs'
import { connectProductionD1Rest } from './cloudflare-d1-rest.mjs'

const environment = 'production'
const businessId = 'amor-e-sabor'
const managerEmail = process.env.CUTOVER_MANAGER_EMAIL

const summary = async lines => {
  if (!process.env.GITHUB_STEP_SUMMARY) return
  await appendFile(process.env.GITHUB_STEP_SUMMARY, [...lines, ''].join('\n'))
}

async function withDb(fn) {
  const connection = await connectProductionD1Rest(environment, { env: process.env })
  try {
    return await fn(connection.db)
  } finally {
    await connection.dispose()
  }
}

async function resolveAdminAccountId() {
  const row = await withDb(db => db.prepare(
    'SELECT account_id FROM platform_bootstraps WHERE environment=? LIMIT 1',
  ).bind(environment).first())
  if (!row?.account_id) throw new Error('Production platform bootstrap is unavailable.')
  return row.account_id
}

async function resolveManagerAccountId() {
  const email = normalizeAccessEmail(managerEmail)
  const row = await withDb(db => db.prepare(
    'SELECT id FROM accounts WHERE email_normalized=? AND active=1 LIMIT 1',
  ).bind(email).first())
  if (!row?.id) throw new Error('Prepared manager account is unavailable.')
  return row.id
}

async function main() {
  if (process.env.LOGIN_VERIFIED !== 'true'
    || process.env.INVENTORY_REVIEWED !== 'true'
    || process.env.FINALIZATION_CONFIRMED !== 'true') {
    throw new Error('Explicit finalization confirmations are required.')
  }
  if (!managerEmail?.trim()) throw new Error('Private manager e-mail configuration is required.')

  const adminAccountId = await resolveAdminAccountId()
  const managerAccountId = await resolveManagerAccountId()

  const inventory = await runMultiCompanyProductionAdmin([
    'inspect-inventory',
    '--env', environment,
    '--admin-account-id', adminAccountId,
  ], {
    connect: connectProductionD1Rest,
    env: process.env,
    log() {},
  })
  if (!Array.isArray(inventory?.items) || inventory.items.some(item => item.businessId !== businessId)) {
    throw new Error('Legacy inventory changed or contains an unexpected business.')
  }

  const readiness = await runMultiCompanyProductionAdmin([
    'check-ready',
    '--env', environment,
    '--admin-account-id', adminAccountId,
    '--business-id', businessId,
    '--manager-account-id', managerAccountId,
  ], {
    connect: connectProductionD1Rest,
    env: process.env,
    log() {},
  })
  if (readiness?.ready !== true) throw new Error('Production readiness is no longer satisfied.')

  const finalized = await runMultiCompanyProductionAdmin([
    'finalize-legacy',
    '--env', environment,
    '--admin-account-id', adminAccountId,
    '--business-id', businessId,
    '--manager-account-id', managerAccountId,
    '--login-verified',
    '--inventory-reviewed',
  ], {
    connect: connectProductionD1Rest,
    env: process.env,
    log() {},
  })

  const verification = await withDb(async db => {
    const state = await db.prepare(
      'SELECT mode FROM business_auth_state WHERE business_id=? LIMIT 1',
    ).bind(businessId).first()
    const pin = await db.prepare(
      'SELECT count(*) AS n FROM auth_credentials WHERE business_id=?',
    ).bind(businessId).first()
    const bootstrap = await db.prepare(
      'SELECT finalized_at FROM platform_bootstraps WHERE environment=? AND account_id=? LIMIT 1',
    ).bind(environment, adminAccountId).first()
    return {
      mode: state?.mode,
      pinCount: Number(pin?.n ?? -1),
      finalizedAt: bootstrap?.finalized_at || null,
    }
  })

  if (verification.mode !== 'user_only' || verification.pinCount !== 0 || !verification.finalizedAt) {
    throw new Error('Final production state verification failed.')
  }

  await summary([
    '### Corte multiempresa finalizado',
    '',
    '- Estado de autenticação: `user_only`',
    '- PIN legado removido: sim',
    '- Bootstrap de produção finalizado: sim',
    `- Alteração aplicada nesta execução: ${finalized?.changed === true ? 'sim' : 'já estava finalizado'}`,
    '',
    'Rollback após esta etapa exige restauração explícita do D1 e bundle compatível; não recrie o PIN manualmente.',
  ])

  console.log(JSON.stringify({
    action: 'finalize-production-cutover',
    environment,
    mode: verification.mode,
    legacyPinRemoved: verification.pinCount === 0,
    finalized: Boolean(finalized?.finalized),
    changed: Boolean(finalized?.changed),
  }))
}

try {
  await main()
} catch {
  console.error('Finalização do corte de produção não concluída. Nenhum segredo foi exibido.')
  process.exitCode = 1
}
