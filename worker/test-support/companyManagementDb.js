import { createTenancyFixture } from './tenancyDb.js'
import { PLATFORM_CAPABILITIES } from '../../shared/companyAccess.js'

export async function createManagementFixture(t) {
  const fixture = await createTenancyFixture(t)
  for (const capability of PLATFORM_CAPABILITIES) fixture.sqlite.prepare('INSERT INTO platform_grants(account_id,capability,created_at) VALUES(?,?,?) ON CONFLICT DO NOTHING').run(fixture.accounts.admin,capability,fixture.now.toISOString())
  return fixture
}
