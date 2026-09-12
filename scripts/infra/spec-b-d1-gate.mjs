import { spawn } from 'node:child_process'
import { mkdtemp, readFile, readdir, writeFile, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir, homedir } from 'node:os'
import { dirname, join, resolve, relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'

const root = fileURLToPath(new URL('../../', import.meta.url))
const version = '4.128.0'

async function findWrangler() {
  const candidates = []
  try { candidates.push(createRequire(import.meta.url).resolve('wrangler/package.json')) } catch { /* try the local npm executable cache */ }
  const cache = process.env.npm_config_cache ?? (process.platform === 'win32'
    ? join(process.env.LOCALAPPDATA, 'npm-cache') : join(homedir(), '.npm'))
  try {
    for (const name of await readdir(join(cache, '_npx'))) candidates.push(join(cache, '_npx', name, 'node_modules/wrangler/package.json'))
  } catch (error) { if (error.code !== 'ENOENT') throw error }
  for (const candidate of candidates) {
    try {
      const pkg = JSON.parse(await readFile(candidate, 'utf8'))
      if (pkg.version === version) return join(dirname(candidate), 'bin/wrangler.js')
    } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  throw new Error(`Wrangler ${version} is required locally (npm exec --yes --package=wrangler@${version} -- wrangler --version). Gate cannot skip.`)
}

async function freePort() {
  const server = createServer()
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const { port } = server.address()
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  return port
}

async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return
  if (process.platform === 'win32') {
    await new Promise((resolve, reject) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
      killer.once('error', reject)
      killer.once('close', (code) => code === 0 || child.exitCode !== null ? resolve() : reject(new Error(`Cannot stop probe process ${child.pid}`)))
    })
  } else {
    process.kill(-child.pid, 'SIGTERM')
  }
}

async function removeProbeDirectory(temp) {
  const relativeTarget = relative(resolve(tmpdir()), resolve(temp))
  if (!relativeTarget || relativeTarget.startsWith('..') || isAbsolute(relativeTarget) || !relativeTarget.startsWith('spec-b-d1-')) {
    throw new Error('Unsafe temporary cleanup path')
  }
  await rm(temp, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 })
}

let temp
let child
let output
let failure
try {
  const wrangler = await findWrangler()
  temp = await mkdtemp(join(tmpdir(), 'spec-b-d1-'))
  const config = JSON.parse(await readFile(join(root, 'scripts/infra/spec-b-wrangler.jsonc'), 'utf8'))
  const base = join(root, 'scripts/infra')
  config.main = resolve(base, config.main)
  config.d1_databases[0].migrations_dir = resolve(base, config.d1_databases[0].migrations_dir)
  const runId = randomUUID()
  config.vars = { PROBE_RUN_ID: runId }
  const configPath = join(temp, 'wrangler.jsonc')
  await writeFile(configPath, JSON.stringify(config))
  // CWD and config both live in a fresh directory: no project .env/.dev.vars, auth
  // profile, inherited Cloudflare tokens, application endpoints or persistent DBs.
  const env = Object.fromEntries(['SystemRoot', 'SYSTEMROOT', 'PATH', 'Path', 'TEMP', 'TMP', 'ComSpec'].filter((key) => process.env[key]).map((key) => [key, process.env[key]]))
  Object.assign(env, { USERPROFILE: temp, APPDATA: temp, LOCALAPPDATA: temp, XDG_CONFIG_HOME: temp,
    CI: 'true', WRANGLER_SEND_METRICS: 'false', CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false', WRANGLER_LOG_PATH: join(temp, 'logs') })
  const persist = join(temp, 'state')
  const options = { cwd: temp, env, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] }
  const run = (args) => new Promise((resolve, reject) => {
    const processChild = spawn(process.execPath, [wrangler, ...args], options)
    let log = ''
    const timer = setTimeout(() => { void stop(processChild).then(() => reject(new Error('Wrangler migration timeout')), reject) }, 60000)
    processChild.stdout.on('data', (chunk) => { log = (log + chunk).slice(-40000) })
    processChild.stderr.on('data', (chunk) => { log = (log + chunk).slice(-40000) })
    processChild.once('error', (error) => { clearTimeout(timer); reject(error) })
    processChild.once('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(log)
      else reject(new Error(`Wrangler exited ${code}: ${log}`))
    })
  })
  await run(['d1', 'migrations', 'apply', 'DB', '--local', '--config', configPath, '--persist-to', persist])
  const port = await freePort()
  const inspectorPort = await freePort()
  child = spawn(process.execPath, [wrangler, 'dev', '--local', '--config', configPath, '--ip', '127.0.0.1', '--port', String(port),
    '--inspector-ip', '127.0.0.1', '--inspector-port', String(inspectorPort), '--persist-to', persist, '--show-interactive-dev-session=false'], options)
  let logs = ''
  let spawnError
  child.stdout.on('data', (chunk) => { logs = (logs + chunk).slice(-12000) })
  child.stderr.on('data', (chunk) => { logs = (logs + chunk).slice(-12000) })
  child.once('error', (error) => { spawnError = error })
  const origin = `http://127.0.0.1:${port}`
  const deadline = Date.now() + 45000
  let ready = false
  while (Date.now() < deadline) {
    if (spawnError) throw spawnError
    if (child.exitCode !== null) throw new Error(`Probe exited ${child.exitCode}: ${logs}`)
    try {
      const response = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(1000) })
      ready = response.ok && (await response.json()).probe === runId
      if (ready) break
    } catch { /* wait for startup; deadline below is a blocking failure */ }
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  if (!ready) throw new Error(`Probe startup timeout: ${logs}`)
  const response = await fetch(`${origin}/probe`, { method: 'POST', signal: AbortSignal.timeout(45000) })
  const result = await response.json()
  if (!response.ok || result.ok !== true || Object.keys(result.checks ?? {}).length !== 9 || Object.values(result.checks).some((value) => value !== true)) {
    throw new Error(`D1 probe failed: ${JSON.stringify(result)}`)
  }
  output = { ...result, wrangler: version, local: true, migrations: 24 }
} catch (error) {
  failure = error
} finally {
  try {
    await stop(child)
    if (temp) await removeProbeDirectory(temp)
  } catch (error) { failure ??= error }
}
if (failure) {
  process.stdout.write(`${JSON.stringify({ ok: false, error: failure.message })}\n`)
  process.exitCode = 1
} else {
  process.stdout.write(`${JSON.stringify(output)}\n`)
}
