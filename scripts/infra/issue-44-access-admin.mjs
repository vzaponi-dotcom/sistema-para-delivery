import { readFileSync } from 'node:fs'
import { mkdtemp, readdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir, homedir } from 'node:os'
import { dirname, join, resolve, relative, isAbsolute } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { BUSINESS_ID } from '../../worker/index.js'
import { issueInitialManager, issueEmergencyInvite, preflightCutover, cutoverBusinessAuth } from '../../worker/access/cutover.js'

const root=fileURLToPath(new URL('../../',import.meta.url)),version='4.128.0'
const environments=['local','staging','production']
const commands=['issue-initial-manager','preflight','cutover','issue-emergency-invite']

export function makeProxyConfig(environment,env=process.env) {
  if(!environments.includes(environment)) throw new Error('Specify --env local, staging or production.')
  const remote=environment!=='local'
  if(remote && (!env.CLOUDFLARE_API_TOKEN || !/^[a-f0-9]{32}$/i.test(env.CLOUDFLARE_ACCOUNT_ID||''))) {
    throw new Error('Infrastructure CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required.')
  }
  // Source of authority is the reviewed deployment config. No database, account,
  // tenant or HTTP endpoint may be supplied by application callers/CLI flags.
  const config=JSON.parse(readFileSync(join(root,'wrangler.jsonc'),'utf8'))
  const binding=(environment==='staging'?config.env.staging:config).d1_databases.find(b=>b.binding==='DB')
  if(!binding?.database_id) throw new Error('Configured DB binding missing.')
  return {name:`issue-44-access-admin-${environment}`,compatibility_date:config.compatibility_date,
    ...(remote?{account_id:env.CLOUDFLARE_ACCOUNT_ID}:{}),
    d1_databases:[{binding:'DB',database_name:binding.database_name,database_id:binding.database_id,remote}]}
}

async function loadWrangler() {
  const require=createRequire(import.meta.url),candidates=[]
  try {candidates.push(require.resolve('wrangler/package.json'))} catch { /* cached pinned CLI below */ }
  const cache=process.env.npm_config_cache ?? (process.platform==='win32'?join(process.env.LOCALAPPDATA,'npm-cache'):join(homedir(),'.npm'))
  try {for(const name of await readdir(join(cache,'_npx'))) candidates.push(join(cache,'_npx',name,'node_modules/wrangler/package.json'))} catch(error) {if(error.code!=='ENOENT') throw error}
  for(const candidate of candidates) {
    try {
      const pkg=JSON.parse(await readFile(candidate,'utf8'))
      if(pkg.version===version) return require(dirname(candidate))
    } catch(error) {if(error.code!=='ENOENT') throw error}
  }
  throw new Error(`Install the pinned CLI first: npm exec --yes --package=wrangler@${version} -- wrangler --version`)
}

export async function connectInfrastructure(environment,{getPlatformProxy,env=process.env}={}) {
  const config=makeProxyConfig(environment,env)
  const proxyFactory=getPlatformProxy || (await loadWrangler()).getPlatformProxy
  const directory=await mkdtemp(join(tmpdir(),'issue-44-access-admin-'))
  const cleanup=async()=>{
    const target=relative(resolve(tmpdir()),resolve(directory))
    if(!target || target.startsWith('..') || isAbsolute(target) || !target.startsWith('issue-44-access-admin-')) throw new Error('Unsafe temporary path.')
    await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100})
  }
  try {
    const configPath=join(directory,'wrangler.jsonc')
    await writeFile(configPath,JSON.stringify(config))
    const platform=await proxyFactory({configPath,remoteBindings:environment!=='local',
      persist:environment==='local'?{path:join(root,'.wrangler/state/v3')}:false})
    return {db:platform.env.DB,dispose:async()=>{try {await platform.dispose()} finally {await cleanup()}}}
  } catch(error) {await cleanup();throw error}
}

export async function runAdmin(args,{connect=connectInfrastructure,log=console.log,deliver=v=>console.log(JSON.stringify(v)),isTTY=process.stdout.isTTY}={}) {
  const [command,...flags]=args,options={}
  if(!commands.includes(command)) throw new Error(`Command required: ${commands.join(', ')}`)
  const allowed=new Set(['--env',...(command==='issue-initial-manager'?['--identifier','--name','--show-invite-once']:command==='issue-emergency-invite'?['--user-id','--show-invite-once']:[])])
  for(let index=0;index<flags.length;index++) {
    const key=flags[index]
    if(!allowed.has(key) || Object.hasOwn(options,key)) throw new Error('Unknown or duplicate option.')
    if(key==='--show-invite-once') options[key]=true
    else {const value=flags[++index];if(!value || value.startsWith('--')) throw new Error('Option value required.');options[key]=value}
  }
  if(!environments.includes(options['--env'])) throw new Error('Explicit --env is required.')
  const invitation=command.startsWith('issue-')
  if(invitation && (!options['--show-invite-once'] || !isTTY)) throw new Error('Invitation delivery requires a private interactive terminal and --show-invite-once.')
  if(command==='issue-initial-manager' && (!options['--identifier'] || !options['--name'])) throw new Error('--identifier and --name required.')
  if(command==='issue-emergency-invite' && !options['--user-id']) throw new Error('--user-id required.')
  const connection=await connect(options['--env'])
  try {
    let result
    if(command==='preflight') result=await preflightCutover(connection.db,BUSINESS_ID)
    else if(command==='cutover') await cutoverBusinessAuth(connection.db,BUSINESS_ID,new Date())
    else if(command==='issue-initial-manager') result=await issueInitialManager(connection.db,BUSINESS_ID,{identifier:options['--identifier'],displayName:options['--name']})
    else result=await issueEmergencyInvite(connection.db,BUSINESS_ID,options['--user-id'])
    log(JSON.stringify({action:command,environment:options['--env'],businessId:BUSINESS_ID,
      ...(command==='preflight'?result:{ok:true}),...(result?.userId?{userId:result.userId}:{})}))
    // The one deliberate output channel. Never emit before commit, in errors,
    // audit/log metadata, URL query strings, files, or noninteractive pipelines.
    if(invitation) deliver({userId:result.userId,token:result.token,expiresAt:result.expiresAt})
    return command==='preflight'?result.ready:true
  } catch(error) {
    log(JSON.stringify({action:command,environment:options['--env'],businessId:BUSINESS_ID,ok:false}))
    throw error
  } finally {await connection.dispose()}
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  // Prevent verbose Wrangler diagnostics; secrets are supplied by a secure
  // environment injector, never command arguments or the temporary config.
  process.env.WRANGLER_LOG='error'
  process.env.WRANGLER_SEND_METRICS='false'
  process.env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV='false'
  try {if(!await runAdmin(process.argv.slice(2))) process.exitCode=1}
  catch {console.error('Access administration failed. No secret details emitted. Run preflight and consult the recovery runbook before retrying.');process.exitCode=1}
}
