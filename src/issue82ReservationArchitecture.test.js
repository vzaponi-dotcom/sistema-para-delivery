import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import test from 'node:test'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = (relativePath) => readFile(path.join(root, relativePath), 'utf8')

const walk = async (relativeDir) => {
  const absolute = path.join(root, relativeDir)
  const entries = await readdir(absolute, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const relative = path.join(relativeDir, entry.name)
    if (entry.isDirectory()) files.push(...await walk(relative))
    else files.push(relative.replaceAll('\\', '/'))
  }
  return files
}

const productionSourceFiles = async () => (await walk('src'))
  .filter((file) => /\.(js|jsx)$/.test(file) && !/\.test\.(js|jsx)$/.test(file))

test('Issue 82 keeps reservation ownership behind existing public boundaries', async () => {
  const [app, workerIndex, tableServiceIndex, api] = await Promise.all([
    read('src/App.jsx'),
    read('worker/index.js'),
    read('src/domains/table-service/index.js'),
    read('src/domains/table-service/infrastructure/tableReservationApi.js'),
  ])

  assert.match(app, /from '\.\/domains\/table-service\/index\.js'/)
  assert.doesNotMatch(app, /from '\.\/domains\/table-service\/(?!index\.js)/)
  assert.match(workerIndex, /handleTableReservationApi/)
  assert.doesNotMatch(workerIndex, /\/api\/table-reservations/)
  assert.match(api, /\/api\/table-reservations/)
  assert.match(tableServiceIndex, /tableReservationApi/)
  assert.doesNotMatch(tableServiceIndex, /domains\/orders/)
})

test('Issue 82 adds no reservation capability family and reuses existing order capabilities', async () => {
  const api = await read('worker/tableReservationApi.js')
  const capabilities = [...api.matchAll(/requireCapability\(context, '([^']+)'\)/g)].map((match) => match[1])
  assert.deepEqual([...new Set(capabilities)].sort(), ['orders.cancel', 'orders.create', 'orders.discount'])
  assert.doesNotMatch(api, /reservations\.[a-z]/i)
})

test('Issue 82 keeps reservation state out of bootstrap/global runtime collections', async () => {
  const [runtime, app] = await Promise.all([
    read('src/app/runtime/data/useOperationalDataRuntime.js'),
    read('src/App.jsx'),
  ])
  assert.doesNotMatch(runtime, /tableReservations/)
  assert.doesNotMatch(app, /\btableReservations\b/)
})

test('Issue 82 keeps SQL out of React production files', async () => {
  const files = (await productionSourceFiles()).filter((file) => file.endsWith('.jsx'))
  const sqlPattern = /\b(?:SELECT\s+.+\s+FROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE)\b/is
  const offenders = []
  for (const file of files) {
    const source = await read(file)
    if (sqlPattern.test(source)) offenders.push(file)
  }
  assert.deepEqual(offenders, [])
})

test('Issue 82 keeps backend reservation error codes out of frontend production source', async () => {
  const offenders = []
  for (const file of await productionSourceFiles()) {
    const source = await read(file)
    if (/TABLE_RESERVATION_[A-Z_]+/.test(source)) offenders.push(file)
  }
  assert.deepEqual(offenders, [])
})

test('Issue 82 uses migration 0034 without runtime schema fallback', async () => {
  const [migration, api, repository, arrival, update] = await Promise.all([
    read('migrations/0034_table_reservations.sql'),
    read('worker/tableReservationApi.js'),
    read('worker/tableReservationRepository.js'),
    read('worker/tableReservationArrival.js'),
    read('worker/tableReservationUpdate.js'),
  ])

  assert.match(migration, /CREATE TABLE table_reservations/)
  assert.match(migration, /idx_table_reservations_business_status_schedule/)
  for (const source of [api, repository, arrival, update]) {
    assert.doesNotMatch(source, /PRAGMA\s+table_info\s*\(\s*table_reservations/i)
    assert.doesNotMatch(source, /sqlite_master[^\n]+table_reservations/i)
    assert.doesNotMatch(source, /ALTER\s+TABLE\s+table_reservations/i)
  }
})
