import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { connectInfrastructure, makeProxyConfig } from './issue-44-access-admin.mjs'
import { preparePlatformAdministrator, prepareExistingBusinessManager, readMultiCompanyReadiness, finalizeMultiCompanyStaging, issueVerifiedAccountRecovery } from '../../worker/platform/bootstrap.js'
import { readEmailConfig } from '../../worker/access/emailDelivery.js'
import { deliverPersistedIdentityMessage } from '../../worker/identity/emailMessages.js'
import { deliverPersistedCompanyInvitation } from '../../worker/tenancy/companyInvitations.js'

const fields = {
  'prepare-admin': ['--name', '--email', '--ownership-verified'],
  'prepare-business-manager': ['--business-id', '--name', '--email', '--ownership-verified'],
  'check-ready': ['--admin-account-id', '--business-id', '--manager-account-id'],
  'finalize-legacy': ['--admin-account-id', '--business-id', '--manager-account-id', '--login-verified'],
  'issue-account-recovery': ['--account-id', '--ownership-verified', '--show-link-once'],
}
const booleans = new Set(['--ownership-verified', '--show-link-once', '--login-verified'])
export async function runMultiCompanyStagingAdmin(args, { connect = connectInfrastructure, env = process.env, isTTY = process.stdout.isTTY, log = console.log, emitPrivateLink = console.log, fetchImpl = fetch } = {}) {
  const [command, ...flags] = args, options = {}, allowed = new Set(['--env', ...(fields[command] || [])])
  if (!fields[command]) throw new Error('Comando administrativo inválido.')
  for (let index = 0; index < flags.length; index++) {
    const key = flags[index], value = booleans.has(key) ? true : flags[++index]
    if (!allowed.has(key) || Object.hasOwn(options, key) || !value || (typeof value === 'string' && value.startsWith('--'))) throw new Error('Opção inválida, repetida ou sem valor.')
    options[key] = value
  }
  if (options['--env'] !== 'staging') throw new Error('Este procedimento exige --env staging.')
  for (const key of fields[command]) if (!options[key]) throw new Error('Informe os campos obrigatórios do procedimento.')
  if (command === 'issue-account-recovery' && !isTTY) throw new Error('A emissão exige terminal privado interativo e prova de titularidade.')
  // Validate the explicit credentials even with an injected connection port;
  // never fall back to interactive OAuth or another infrastructure account.
  makeProxyConfig('staging', env)
  const vars = JSON.parse(readFileSync(new URL('../../wrangler.jsonc', import.meta.url), 'utf8')).env.staging.vars
  const deliveryEnv = { ...vars, ...env }
  if (command.startsWith('prepare-') || command === 'issue-account-recovery') readEmailConfig(deliveryEnv)
  let connection
  try {
    connection = await connect('staging', { env })
    let result
    const input = { name: options['--name'], email: options['--email'], ownershipVerified: options['--ownership-verified'], businessId: options['--business-id'], dailyLimit: Number(deliveryEnv.AUTH_EMAIL_DAILY_LIMIT || 80) }
    if (command === 'prepare-admin') {
      const prepared = await preparePlatformAdministrator(connection.db, input)
      result = { accountId: prepared.accountId, activated: prepared.activated }
      if (prepared.challenge) result.delivery = await deliverPersistedIdentityMessage(connection.db, deliveryEnv, prepared.challenge, { fetchImpl })
    } else if (command === 'prepare-business-manager') {
      const prepared = await prepareExistingBusinessManager(connection.db, input)
      result = { accountId: prepared.accountId, userId: prepared.userId, activated: prepared.activated }
      if (prepared.invitation) result.delivery = await deliverPersistedCompanyInvitation(connection.db, deliveryEnv, prepared.invitation, { deliver: (emailEnv, message) => import('../../worker/identity/emailMessages.js').then(module => module.deliverIdentityMessage(emailEnv, message, { fetchImpl })) })
    } else if (command === 'issue-account-recovery') {
      const challenge = await issueVerifiedAccountRecovery(connection.db, { accountId: options['--account-id'], ownershipVerified: true })
      const link = new URL('/redefinir-senha', readEmailConfig(deliveryEnv).publicOrigin)
      link.hash = new URLSearchParams({ token: challenge.token }).toString()
      emitPrivateLink(link.href)
      result = { issued: true, expiresAt: challenge.expiresAt }
    } else {
      const readiness = await readMultiCompanyReadiness(connection.db, { adminAccountId: options['--admin-account-id'], businessId: input.businessId, managerAccountId: options['--manager-account-id'] })
      if (command === 'check-ready') result = readiness
      else {
        const record = await connection.db.prepare("SELECT legacy_inventory_json FROM platform_bootstraps WHERE environment='staging' AND account_id=?").bind(readiness.adminAccountId).first()
        result = await finalizeMultiCompanyStaging(connection.db, JSON.parse(record?.legacy_inventory_json || 'null'), { ...readiness, loginVerified: true })
      }
    }
    log(JSON.stringify({ action: command, environment: 'staging', ...result }))
    return result
  } catch { throw new Error('Procedimento não concluído. Confira o roteiro de staging; nenhum segredo foi exibido.') }
  finally { try { await connection?.dispose() } catch { throw new Error('Não foi possível encerrar a conexão administrativa. Nenhum segredo foi exibido.') } }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.env.WRANGLER_LOG = 'error'; process.env.WRANGLER_SEND_METRICS = 'false'; process.env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV = 'false'
  try { await runMultiCompanyStagingAdmin(process.argv.slice(2)) } catch { console.error('Preparação multiempresa não concluída. Consulte o roteiro; nenhum segredo foi exibido.'); process.exitCode = 1 }
}
