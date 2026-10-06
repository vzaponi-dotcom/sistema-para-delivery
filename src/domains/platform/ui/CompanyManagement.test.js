import test from 'node:test'
import assert from 'node:assert/strict'
import { workspaceHarness, nodeText, buttonNamed } from '../../../test-support/renderWorkspace.js'
import { act } from 'react-test-renderer'
import React from 'react'
import { companyStatus } from './companyStatus.js'

test('company lifecycle overrides accepted invitation in administrative status',()=>{
  assert.equal(companyStatus({accessStatus:'active',lifecycleStatus:'deleted',invitation:{status:'accepted'}}).access,'Excluída')
  assert.equal(companyStatus({accessStatus:'active',lifecycleStatus:'suspended',invitation:{status:'accepted'}}).access,'Suspensa')
})

test('late management completion from a previous context cannot publish success into the new context',async t=>{
  const h=await workspaceHarness(t),{default:Detail}=await h.load('/src/domains/platform/ui/CompanyDetail.jsx'),guards=[]
  let finish
  const api={getBusiness:async()=>({id:'A',name:'A',lifecycleStatus:'enabled',accessStatus:'active',managementRevision:0}),manageBusiness:async()=>new Promise(resolve=>{finish=resolve})}
  const props={businessId:'A',accountId:'admin',contextId:'old',capabilities:['platform.businesses.manage'],api,onPendingChange:value=>guards.push(value)}
  const renderer=await h.render(Detail,props)
  await act(async()=>buttonNamed(renderer.root,'Suspender acesso').props.onClick())
  const dialog=renderer.root.findByProps({role:'dialog'})
  await act(async()=>dialog.findByType('textarea').props.onChange({target:{value:'Manutenção'}}))
  await act(async()=>{void buttonNamed(dialog,'Confirmar suspensão').props.onClick()})
  await act(async()=>renderer.update(React.createElement(Detail,{...props,contextId:'new'})))
  await act(async()=>finish({businessId:'A',managementRevision:1}))
  assert.doesNotMatch(nodeText(renderer.root),/Ação confirmada/)
  assert.equal(guards.at(-1),false)
})

test('management detail offers approved tabs and explicit recoverable deletion confirmation',async t=>{
  const h=await workspaceHarness(t),{default:Detail}=await h.load('/src/domains/platform/ui/CompanyDetail.jsx'),calls=[]
  let company={id:'A',name:'Cozinha A',accessStatus:'active',lifecycleStatus:'enabled',managementRevision:0,firstManager:{name:'Ana'},history:[]}
  const api={getBusiness:async()=>company,manageBusiness:async(target,input)=>{calls.push({target,input});company={...company,lifecycleStatus:'deleted',managementRevision:1};return {businessId:'A',managementRevision:1}}}
  const renderer=await h.render(Detail,{businessId:'A',accountId:'admin',contextId:'platform-A',capabilities:['platform.businesses.delete','platform.businesses.manage','platform.memberships.view'],api})
  assert.match(nodeText(renderer.root),/Visão geral.*Pessoas e convites.*Histórico/s)
  await act(async()=>buttonNamed(renderer.root,'Excluir empresa').props.onClick())
  const dialog=renderer.root.findByProps({role:'dialog'})
  assert.match(nodeText(dialog),/preservad|restaur/i)
  const reason=dialog.findByType('textarea'),name=dialog.findByProps({name:'confirmationName'})
  await act(async()=>{reason.props.onChange({target:{value:'Cadastro duplicado'}});name.props.onChange({target:{value:'Errado'}})})
  assert.equal(buttonNamed(dialog,'Confirmar exclusão').props.disabled,true)
  await act(async()=>name.props.onChange({target:{value:'Cozinha A'}}))
  await act(async()=>buttonNamed(dialog,'Confirmar exclusão').props.onClick())
  assert.equal(calls.length,1)
  assert.equal(calls[0].input.expectedRevision,0)
  assert.match(nodeText(renderer.root),/Excluída/)
  assert.ok(buttonNamed(renderer.root,'Restaurar empresa'))
})

test('confirmation stays mounted and pending until the canonical detail refresh completes',async t=>{
  const h=await workspaceHarness(t),{default:Detail}=await h.load('/src/domains/platform/ui/CompanyDetail.jsx')
  let reads=0,finishRead
  const company={id:'A',name:'A',lifecycleStatus:'enabled',accessStatus:'active',managementRevision:0}
  const api={getBusiness:async()=>++reads===1?company:new Promise(resolve=>{finishRead=resolve}),manageBusiness:async()=>({businessId:'A',managementRevision:1})}
  const renderer=await h.render(Detail,{businessId:'A',accountId:'admin',contextId:'ctx',capabilities:['platform.businesses.manage'],api})
  await act(async()=>buttonNamed(renderer.root,'Suspender acesso').props.onClick())
  const dialog=renderer.root.findByProps({role:'dialog'})
  await act(async()=>dialog.findByType('textarea').props.onChange({target:{value:'Manutenção'}}))
  await act(async()=>{void buttonNamed(dialog,'Confirmar suspensão').props.onClick()})
  assert.equal(renderer.root.findAllByProps({role:'dialog'}).length,1)
  assert.equal(buttonNamed(renderer.root.findByProps({role:'dialog'}),'Confirmando…').props.disabled,true)
  await act(async()=>finishRead({...company,lifecycleStatus:'suspended',managementRevision:1}))
  assert.equal(renderer.root.findAllByProps({role:'dialog'}).length,0)
})
