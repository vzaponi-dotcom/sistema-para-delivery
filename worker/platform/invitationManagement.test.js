import test from 'node:test'
import assert from 'node:assert/strict'
import { createManagementFixture } from '../test-support/companyManagementDb.js'
import { prepareMembershipInvitation, acceptCompanyInvitation } from '../tenancy/companyInvitations.js'
import { commitIdentityStatements } from '../identity/transactions.js'
import { performBusinessManagement } from './managementCommands.js'
import { listPlatformHistory, listPlatformMemberships, getPlatformManagementAttempt } from './managementRepository.js'

const env=f=>({DB:f.db,AUTH_MULTI_COMPANY_ENABLED:true,RESEND_API_KEY:'synthetic',AUTH_EMAIL_FROM:'Mesiva <access@example.test>',AUTH_PUBLIC_ORIGIN:'https://example.test'})
test('platform can resend team invitation without operational membership and replay never sends another email',async t=>{
  const f=await createManagementFixture(t)
  const initial=await prepareMembershipInvitation(f.db,{businessId:f.businesses.A,accountEmail:'invitee@example.test',displayName:'Nova pessoa',roleId:`${f.businesses.A}:operator`,issuer:f.contexts.aliceA,now:f.now})
  await commitIdentityStatements(f.db,initial.statements)
  const messages=[],at=new Date(f.now.getTime()+61000),target={businessId:f.businesses.A,operation:'invitation.resend',invitationId:initial.value.invitationId},input={reason:'Novo convite solicitado',expectedRevision:0},key=crypto.randomUUID()
  input.expectedRevision=1
  const options={idempotencyKey:key,now:at,deliver:async (_env,message)=>{messages.push(message);return {status:'uncertain'}}}
  const result=await performBusinessManagement(env(f),f.contexts.admin,target,input,options)
  await performBusinessManagement(env(f),f.contexts.admin,target,input,options)
  assert.equal(messages.length,1)
  assert.equal(result.delivery.status,'uncertain')
  assert.equal(f.sqlite.prepare('SELECT issuer_scope FROM company_invitations WHERE id=?').get(result.invitationId).issuer_scope,'platform')
  assert.ok(f.sqlite.prepare('SELECT revoked_at FROM company_invitations WHERE id=?').get(initial.value.invitationId).revoked_at)
  await acceptCompanyInvitation(f.db,{token:messages[0].token,password:'Valid password 2026!',now:at})
  assert.equal(f.sqlite.prepare('SELECT membership_state FROM users WHERE id=?').get(initial.value.userId).membership_state,'active')
})
test('cancel expired invitation preserves invited membership and invalidates old link',async t=>{
  const f=await createManagementFixture(t)
  const prepared=await prepareMembershipInvitation(f.db,{businessId:f.businesses.A,accountEmail:'second@example.test',displayName:'Convidado',roleId:`${f.businesses.A}:operator`,issuer:f.contexts.aliceA,now:f.now})
  await commitIdentityStatements(f.db,prepared.statements)
  f.sqlite.prepare('UPDATE company_invitations SET expires_at=? WHERE id=?').run(new Date(f.now.getTime()+1).toISOString(),prepared.value.invitationId)
  await performBusinessManagement(env(f),f.contexts.admin,{businessId:f.businesses.A,operation:'invitation.cancel',invitationId:prepared.value.invitationId},{reason:'Convite cancelado',expectedRevision:1},{idempotencyKey:crypto.randomUUID(),now:new Date(f.now.getTime()+1000)})
  assert.equal(f.sqlite.prepare('SELECT membership_state FROM users WHERE id=?').get(prepared.value.userId).membership_state,'invited')
  assert.ok(f.sqlite.prepare('SELECT revoked_at FROM company_invitations WHERE id=?').get(prepared.value.invitationId).revoked_at)
})

for (const status of ['accepted','rejected','uncertain']) test(`administrative team resend preserves ${status} delivery in subsequent history and membership reads`,async t=>{
  const f=await createManagementFixture(t)
  const initial=await prepareMembershipInvitation(f.db,{businessId:f.businesses.A,accountEmail:'history@example.test',displayName:'Pessoa convidada',roleId:`${f.businesses.A}:operator`,issuer:f.contexts.aliceA,now:f.now})
  await commitIdentityStatements(f.db,initial.statements)
  const key=crypto.randomUUID(),at=new Date(f.now.getTime()+61000)
  const result=await performBusinessManagement(env(f),f.contexts.admin,{businessId:f.businesses.A,operation:'invitation.resend',invitationId:initial.value.invitationId},{reason:'Reenvio solicitado',expectedRevision:1},{idempotencyKey:key,now:at,deliver:async()=>({status})})
  const history=await listPlatformHistory(f.db,f.businesses.A)
  const delivery=history.items.find(item=>item.action===`invitation.delivery.${status}`)
  assert.ok(delivery,'delivery result must remain visible in administrative history')
  assert.equal(delivery.actorName,'Admin')
  assert.equal(delivery.resourceType,'invitation')
  assert.equal(delivery.resourceId,result.invitationId)
  assert.equal(delivery.resourceLabel,'history@example.test')
  assert.equal(delivery.result,status==='accepted'?'success':'failure')
  const members=await listPlatformMemberships(f.db,f.businesses.A,at)
  assert.equal(members.users.find(user=>user.id===initial.value.userId).invitation.deliveryStatus,status)
  assert.equal((await getPlatformManagementAttempt(f.db,f.accounts.admin,f.businesses.A,key)).result.delivery.status,status)
})
