import test from 'node:test'
import assert from 'node:assert/strict'
import { createSettingsDb } from '../../worker/test-support/settingsDb.js'
import { readFile, access } from 'node:fs/promises'
import { runAdmin, makeProxyConfig, connectInfrastructure } from './issue-44-access-admin.mjs'

test('remote transport requires infra token/account, fixed tenant, explicit environment and rejects arbitrary authority',()=>{
  assert.throws(()=>makeProxyConfig('production',{}))
  assert.throws(()=>makeProxyConfig('unknown',{}))
  const config=makeProxyConfig('staging',{CLOUDFLARE_API_TOKEN:'secret',CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32)})
  assert.equal(config.d1_databases[0].remote,true)
  assert.equal(config.d1_databases[0].database_id,'73a1c0c1-142f-4247-8ffc-e858ab2ac400')
  assert.equal(JSON.stringify(config).includes('secret'),false)
  assert.equal(makeProxyConfig('local',{}).d1_databases[0].remote,false)
})

test('transport forwards actual D1 binding, selects remote only explicitly, disposes and removes temporary config',async()=>{
  for(const environment of ['local','staging','production']) {
    let path,disposed=false
    const actualBinding={batch(){throw new Error('binding sentinel')}}
    const connection=await connectInfrastructure(environment,{env:{CLOUDFLARE_API_TOKEN:'secret',CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32)},
      getPlatformProxy:async options=>{
        path=options.configPath
        const config=JSON.parse(await readFile(path,'utf8'))
        assert.deepEqual(Object.keys(config).sort(),['compatibility_date','d1_databases','name',...(environment==='local'?[]:['account_id'])].sort())
        assert.equal(options.remoteBindings,environment!=='local')
        assert.equal(config.d1_databases[0].remote,environment!=='local')
        assert.equal(JSON.stringify(config).includes('secret'),false)
        return {env:{DB:actualBinding},dispose:async()=>{disposed=true}}
      }})
    assert.equal(connection.db,actualBinding)
    await connection.dispose();assert.equal(disposed,true)
    await assert.rejects(access(path),{code:'ENOENT'})
  }
})
test('CLI validates flags before connecting, logs nonsecrets and only consciously delivers invitation once',async t=>{
  const {db,sqlite,close}=createSettingsDb();t.after(close)
  const logs=[],delivered=[];let calls=0,disposed=0
  const deps={connect:async()=>{calls++;return {db,dispose:async()=>disposed++}},log:v=>logs.push(v),deliver:v=>delivered.push(v),isTTY:true}
  await assert.rejects(runAdmin(['issue-initial-manager','--env','local','--identifier','manager','--name','Manager'],deps))
  await assert.rejects(runAdmin(['preflight','--env','local','--business-id','other'],deps))
  await assert.rejects(runAdmin(['issue-initial-manager','--env','local','--identifier','manager','--name','Manager','--show-invite-once'],{...deps,isTTY:false}))
  assert.equal(calls,0)
  await runAdmin(['issue-initial-manager','--env','local','--identifier','manager','--name','Manager','--show-invite-once'],deps)
  assert.equal(delivered.length,1);assert.match(delivered[0].token,/^[A-Za-z0-9_-]{43}$/)
  assert.equal(JSON.stringify(logs).includes(delivered[0].token),false)
  assert.equal(JSON.stringify(logs).includes('password'),false)
  assert.equal(sqlite.prepare('SELECT business_id FROM users').get().business_id,'amor-e-sabor')
  assert.equal(disposed,1)
  await assert.rejects(runAdmin(['issue-emergency-invite','--env','local','--user-id','missing','--show-invite-once'],deps))
  assert.equal(disposed,2);assert.equal(delivered.length,1)
})
