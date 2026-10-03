import test from 'node:test'
import assert from 'node:assert/strict'
import { createTenancyFixture } from '../test-support/tenancyDb.js'
import { requirePlatformCapability, requireCurrentPlatformCapability } from './access.js'

test('platform capabilities are explicit and require a current platform session', async t => {
  const f = await createTenancyFixture(t)
  assert.throws(() => requirePlatformCapability(f.contexts.aliceA, 'platform.businesses.create'), { status: 403 })
  assert.throws(() => requirePlatformCapability({ scope: 'identity', platformGranted: new Set(['*']) }, 'platform.businesses.create'), { status: 403 })
  assert.doesNotThrow(() => requirePlatformCapability({ ...f.contexts.admin, platformGranted: new Set(['platform.businesses.create']) }, 'platform.businesses.create'))
  await requireCurrentPlatformCapability(f.db, f.contexts.admin, 'platform.businesses.view', f.now)
  f.sqlite.prepare("DELETE FROM platform_grants WHERE account_id = ? AND capability = 'platform.businesses.create'").run(f.accounts.admin)
  await assert.rejects(requireCurrentPlatformCapability(f.db, f.contexts.admin, 'platform.businesses.create', f.now), { status: 403 })
})
