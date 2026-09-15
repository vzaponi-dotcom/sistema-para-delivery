// Explicit integration check, separate from npm test because it starts real local D1.
// Windows kill(SIGTERM) is not catchable. emit exercises Node's installed signal
// handler while the actual gate and its supervised migration process are running.
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'

const signal = process.argv[2]
assert.ok(['SIGINT', 'SIGTERM'].includes(signal), 'Pass SIGINT or SIGTERM')
const before = new Set(readdirSync(tmpdir()))
const write = process.stdout.write.bind(process.stdout)
let output = ''
let temporaryStateAtPublication
process.stdout.write = (chunk) => {
  temporaryStateAtPublication = readdirSync(tmpdir()).filter((name) => name.startsWith('spec-b-d1-') && !before.has(name))
  output += chunk
  return true
}
const timer = setTimeout(() => process.emit(signal), 4000)
try {
  await import('./spec-b-d1-gate.mjs')
  const result = JSON.parse(output)
  assert.equal(result.ok, false)
  assert.match(result.error, new RegExp(signal))
  assert.equal(process.exitCode, 1)
  assert.deepEqual(temporaryStateAtPublication, [], 'gate published its result before temporary cleanup completed')
  assert.deepEqual(readdirSync(tmpdir()).filter((name) => name.startsWith('spec-b-d1-') && !before.has(name)), [])
  process.exitCode = 0
  write(`${JSON.stringify({ signal, gate: result, temporaryCleanupConfirmed: true })}\n`)
} finally {
  clearTimeout(timer)
  process.stdout.write = write
}
