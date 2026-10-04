import { appendFile } from 'node:fs/promises'
import { runMultiCompanyProductionAdmin } from './multi-company-production-admin.mjs'
import { connectProductionD1Rest } from './cloudflare-d1-rest.mjs'

const name = process.env.ADMIN_NAME
const email = process.env.ADMIN_EMAIL

if (!name?.trim() || !email?.trim() || process.env.OWNERSHIP_CONFIRMED !== 'true') {
  console.error('Mesiva administrator preparation requires the approved name, e-mail and ownership confirmation.')
  process.exitCode = 1
} else {
  try {
    const result = await runMultiCompanyProductionAdmin([
      'prepare-admin',
      '--env', 'production',
      '--name', name,
      '--email', email,
      '--ownership-verified',
    ], {
      connect: connectProductionD1Rest,
      env: process.env,
      log() {},
    })

    if (!result?.activated && result?.delivery?.status !== 'accepted') {
      throw new Error('Activation delivery was not accepted.')
    }

    const deliveryStatus = result.activated ? 'already-active' : result.delivery.status
    if (process.env.GITHUB_STEP_SUMMARY) {
      await appendFile(
        process.env.GITHUB_STEP_SUMMARY,
        [
          '### Administrador Mesiva',
          '',
          `- Account ID: \`${result.accountId}\``,
          `- Estado: ${result.activated ? 'já ativado' : 'ativação enviada'}`,
          `- Entrega: ${deliveryStatus}`,
          '',
          'Nenhuma empresa foi vinculada a esta conta por este procedimento.',
          '',
        ].join('\n'),
      )
    }

    console.log(JSON.stringify({
      action: 'prepare-admin',
      environment: 'production',
      accountId: result.accountId,
      activated: result.activated,
      deliveryStatus,
    }))
  } catch {
    console.error('Preparação do Administrador Mesiva não concluída. Nenhum segredo foi exibido.')
    process.exitCode = 1
  }
}
