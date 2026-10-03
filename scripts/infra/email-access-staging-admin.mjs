import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { BUSINESS_ID } from '../../worker/index.js'
import { connectInfrastructure } from './issue-44-access-admin.mjs'
import { prepareStagingEmailManager,finalizeStagingEmailAccounts } from '../../worker/access/emailStagingBootstrap.js'
import { readEmailConfig,deliverEmailChallenge,deliverPersistedChallenge } from '../../worker/access/emailDelivery.js'
import { normalizeAccessEmail } from '../../shared/accessEmail.js'

export async function runEmailStagingAdmin(args,{connect=connectInfrastructure,env=process.env,deliver=deliverEmailChallenge,log=console.log}={}) {
  const [command,...flags]=args
  if(!['prepare-manager','finalize-accounts'].includes(command))throw new Error('Specify prepare-manager or finalize-accounts.')
  const options={},allowed=new Set(['--env',...(command==='prepare-manager'?['--name','--email']:['--manager-id'])])
  for(let index=0;index<flags.length;index++){
    const key=flags[index],value=flags[++index]
    if(!allowed.has(key)||Object.hasOwn(options,key)||!value||value.startsWith('--'))throw new Error('Unknown, duplicate or missing option.')
    options[key]=value
  }
  if(options['--env']!=='staging')throw new Error('This preparation is restricted to --env staging.')
  if(command==='prepare-manager'&&(!options['--name']||!options['--email']))throw new Error('--name and --email required.')
  if(command==='finalize-accounts'&&!options['--manager-id'])throw new Error('--manager-id required.')
  const vars=JSON.parse(readFileSync(new URL('../../wrangler.jsonc',import.meta.url),'utf8')).env.staging.vars
  const deliveryEnv={...vars,...env}
  if(command==='prepare-manager'){normalizeAccessEmail(options['--email']);readEmailConfig(deliveryEnv)}
  const connection=await connect('staging')
  try {
    let result
    if(command==='prepare-manager'){
      result=await prepareStagingEmailManager(connection.db,{businessId:BUSINESS_ID,name:options['--name'],email:options['--email'],dailyLimit:readEmailConfig(deliveryEnv).dailyLimit})
      if(result.challenge){
        const delivery=await deliverPersistedChallenge(connection.db,deliveryEnv,{...result.challenge,businessId:BUSINESS_ID,userId:result.userId,purpose:'activation',displayName:result.displayName},{deliver})
        result={userId:result.userId,activated:false,delivery}
      }
    }else result=await finalizeStagingEmailAccounts(connection.db,{businessId:BUSINESS_ID,managerId:options['--manager-id']})
    log(JSON.stringify({action:command,environment:'staging',businessId:BUSINESS_ID,...result}))
    return result
  }catch(error){log(JSON.stringify({action:command,environment:'staging',businessId:BUSINESS_ID,ok:false}));throw error}
  finally {await connection.dispose()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  process.env.WRANGLER_LOG='error';process.env.WRANGLER_SEND_METRICS='false';process.env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV='false'
  try{await runEmailStagingAdmin(process.argv.slice(2))}
  catch{console.error('Staging email preparation failed. No secret details emitted. Consult the staging runbook before retrying.');process.exitCode=1}
}
