import { spawnSync } from 'node:child_process'
const result = spawnSync(process.execPath,['--test','worker/platform/managementMigration.test.js'],{stdio:'inherit',cwd:new URL('../../',import.meta.url)})
if (result.error) throw result.error
process.exitCode = result.status ?? 1
