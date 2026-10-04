import { appendFile } from 'node:fs/promises'
import { normalizeAccessEmail } from '../../shared/accessEmail.js'
import { runMultiCompanyProductionAdmin } from './multi-company-production-admin.mjs'
import { connectProductionD1Rest } from './cloudflare-d1-rest.mjs'

const action = process.env.CUTOVER_ACTION
const environment = 'production'
const businessId = 'amor-e-sabor'
const managerName = process.env.CUTOVER_MANAGER_NAME
const managerEmail = process.env.CUTOVER_MANAGER_EMAIL
const ownershipConfirmed = process.env.OWNERSHIP_CONFIRMED === 'true'

const allowed = new Set(['inspect_inventory', 'prepare_business_manager', 'check_ready'])

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

async function inspectInventory(adminAccountId) {
  const result = await runMultiCompanyProductionAdmin([
    'inspect-inventory',
    '--env', environment,
    '--admin-account-id', adminAccountId,
  ], {
    connect: connectProductionD1Rest,
    env: process.env,
    log() {},
  })
  const inventoryCount = Number(result?.count || 0)
  const items = Array.isArray(result?.items) ? result.items : []
  const activeCount = items.filter(item => item.active === true).length
  const allExpectedBusiness = items.every(item => item.businessId === businessId)
  return { result, inventoryCount, activeCount, allExpectedBusiness }
}

async function main() {
  if (!allowed.has(action)) throw new Error('Invalid production cutover action.')

  const adminAccountId = await resolveAdminAccountId()

  if (action === 'inspect_inventory') {
    const inventory = await inspectInventory(adminAccountId)
    await summary([
      '### Inventário legado de produção',
      '',
      `- Registros inventariados: ${inventory.inventoryCount}`,
      `- Registros ativos: ${inventory.activeCount}`,
      `- Todos pertencem à empresa esperada: ${inventory.allExpectedBusiness ? 'sim' : 'não'}`,
      '',
      'Nenhum nome, e-mail ou identificador humano é publicado pelo workflow.',
      'Nenhum acesso legado foi finalizado.',
    ])
    console.log(JSON.stringify({
      action,
      environment,
      inventoryCount: inventory.inventoryCount,
      activeCount: inventory.activeCount,
      allExpectedBusiness: inventory.allExpectedBusiness,
    }))
    if (!inventory.allExpectedBusiness) throw new Error('Legacy inventory contains an unexpected business.')
    return
  }

  if (action === 'prepare_business_manager') {
    if (!managerName?.trim() || !managerEmail?.trim() || !ownershipConfirmed) {
      throw new Error('Manager preparation requires private manager data and explicit ownership confirmation.')
    }
    const inventory = await inspectInventory(adminAccountId)
    if (!inventory.allExpectedBusiness) throw new Error('Legacy inventory contains an unexpected business.')

    const result = await runMultiCompanyProductionAdmin([
      'prepare-business-manager',
      '--env', environment,
      '--business-id', businessId,
      '--name', managerName,
      '--email', managerEmail,
      '--ownership-verified',
    ], {
      connect: connectProductionD1Rest,
      env: process.env,
      log() {},
    })

    if (!result?.activated && result?.delivery?.status !== 'accepted') {
      throw new Error('Manager invitation delivery was not accepted.')
    }
    const deliveryStatus = result.activated ? 'already-active' : result.delivery.status
    await summary([
      '### Primeiro gerente — Amor & Sabor',
      '',
      `- Estado: ${result.activated ? 'conta já ativada' : 'convite enviado'}`,
      `- Entrega: ${deliveryStatus}`,
      '',
      'Nenhum nome ou e-mail foi publicado pelo workflow.',
      'Nenhum acesso legado foi finalizado.',
    ])
    console.log(JSON.stringify({
      action,
      environment,
      activated: Boolean(result.activated),
      deliveryStatus,
    }))
    return
  }

  if (!managerEmail?.trim()) throw new Error('Manager e-mail secret is required for readiness.')
  const managerAccountId = await resolveManagerAccountId()
  const result = await runMultiCompanyProductionAdmin([
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

  await summary([
    '### Readiness multiempresa — produção',
    '',
    `- Ready: ${result.ready === true ? 'true' : 'false'}`,
    '',
    'Nenhum identificador humano foi publicado pelo workflow.',
    'Nenhum acesso legado foi finalizado.',
  ])
  console.log(JSON.stringify({ action, environment, ready: result.ready === true }))
  if (result.ready !== true) throw new Error('Production multi-company readiness is not satisfied.')
}

try {
  await main()
} catch {
  console.error('Procedimento administrativo do corte de produção não concluído. Nenhum segredo foi exibido.')
  process.exitCode = 1
}
