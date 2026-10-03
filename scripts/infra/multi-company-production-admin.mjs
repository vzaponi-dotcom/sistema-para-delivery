import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { connectInfrastructure, makeProxyConfig } from './issue-44-access-admin.mjs'
import {
  preparePlatformAdministrator,
  prepareExistingBusinessManager,
  readMultiCompanyReadiness,
  finalizeMultiCompanyEnvironment,
  issueVerifiedAccountRecovery,
} from '../../worker/platform/bootstrap.js'
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
const environment = 'production'

const productionDeliveryEnv = (env) => {
  const deliveryEnv = {
    ...env,
    AUTH_MULTI_COMPANY_PREPARE_ENABLED: 'true',
    AUTH_EMAIL_DAILY_LIMIT: env.AUTH_EMAIL_DAILY_LIMIT || '80',
  }
  readEmailConfig(deliveryEnv)
  return deliveryEnv
}

export async function runMultiCompanyProductionAdmin(args, {
  connect = connectInfrastructure,
  env = process.env,
  isTTY = process.stdout.isTTY,
  log = console.log,
  emitPrivateLink = console.log,
  fetchImpl = fetch,
} = {}) {
  const [command, ...flags] = args
  const options = {}
  const allowed = new Set(['--env', ...(fields[command] || [])])
  if (!fields[command]) throw new Error('Comando administrativo inválido.')

  for (let index = 0; index < flags.length; index += 1) {
    const key = flags[index]
    const value = booleans.has(key) ? true : flags[++index]
    if (!allowed.has(key) || Object.hasOwn(options, key) || !value || (typeof value === 'string' && value.startsWith('--'))) {
      throw new Error('Opção inválida, repetida ou sem valor.')
    }
    options[key] = value
  }

  if (options['--env'] !== environment) throw new Error('Este procedimento exige --env production.')
  for (const key of fields[command]) if (!options[key]) throw new Error('Informe os campos obrigatórios do procedimento.')
  if (command === 'issue-account-recovery' && !isTTY) {
    throw new Error('A emissão exige terminal privado interativo e prova de titularidade.')
  }

  // Validate explicit production infrastructure authority before any remote connection.
  makeProxyConfig(environment, env)
  const needsEmail = command.startsWith('prepare-') || command === 'issue-account-recovery'
  const deliveryEnv = needsEmail ? productionDeliveryEnv(env) : env

  let connection
  try {
    connection = await connect(environment, { env })
    let result
    const input = {
      name: options['--name'],
      email: options['--email'],
      ownershipVerified: options['--ownership-verified'],
      businessId: options['--business-id'],
      environment,
      dailyLimit: Number(deliveryEnv.AUTH_EMAIL_DAILY_LIMIT || 80),
    }

    if (command === 'prepare-admin') {
      const prepared = await preparePlatformAdministrator(connection.db, input)
      result = { accountId: prepared.accountId, activated: prepared.activated }
      if (prepared.challenge) {
        result.delivery = await deliverPersistedIdentityMessage(connection.db, deliveryEnv, prepared.challenge, { fetchImpl })
      }
    } else if (command === 'prepare-business-manager') {
      const prepared = await prepareExistingBusinessManager(connection.db, input)
      result = { accountId: prepared.accountId, userId: prepared.userId, activated: prepared.activated }
      if (prepared.invitation) {
        result.delivery = await deliverPersistedCompanyInvitation(connection.db, deliveryEnv, prepared.invitation, {
          deliver: (emailEnv, message) => import('../../worker/identity/emailMessages.js')
            .then(module => module.deliverIdentityMessage(emailEnv, message, { fetchImpl })),
        })
      }
    } else if (command === 'issue-account-recovery') {
      const challenge = await issueVerifiedAccountRecovery(connection.db, {
        accountId: options['--account-id'],
        ownershipVerified: true,
      })
      const link = new URL('/redefinir-senha', readEmailConfig(deliveryEnv).publicOrigin)
      link.hash = new URLSearchParams({ token: challenge.token }).toString()
      emitPrivateLink(link.href)
      result = { issued: true, expiresAt: challenge.expiresAt }
    } else {
      const readiness = await readMultiCompanyReadiness(connection.db, {
        adminAccountId: options['--admin-account-id'],
        businessId: input.businessId,
        managerAccountId: options['--manager-account-id'],
      })
      if (command === 'check-ready') {
        result = readiness
      } else {
        const record = await connection.db.prepare(
          'SELECT legacy_inventory_json FROM platform_bootstraps WHERE environment=? AND account_id=?',
        ).bind(environment, readiness.adminAccountId).first()
        result = await finalizeMultiCompanyEnvironment(
          connection.db,
          JSON.parse(record?.legacy_inventory_json || 'null'),
          { ...readiness, loginVerified: true },
          { environment },
        )
      }
    }

    log(JSON.stringify({ action: command, environment, ...result }))
    return result
  } catch {
    throw new Error('Procedimento de produção não concluído. Confira o roteiro; nenhum segredo foi exibido.')
  } finally {
    try {
      await connection?.dispose()
    } catch {
      throw new Error('Não foi possível encerrar a conexão administrativa. Nenhum segredo foi exibido.')
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.env.WRANGLER_LOG = 'error'
  process.env.WRANGLER_SEND_METRICS = 'false'
  process.env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV = 'false'
  try {
    await runMultiCompanyProductionAdmin(process.argv.slice(2))
  } catch {
    console.error('Preparação multiempresa de produção não concluída. Consulte o roteiro; nenhum segredo foi exibido.')
    process.exitCode = 1
  }
}
