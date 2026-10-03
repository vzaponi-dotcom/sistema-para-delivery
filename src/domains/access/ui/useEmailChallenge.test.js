import test from 'node:test'
import assert from 'node:assert/strict'
import React,{StrictMode} from 'react'
import { workspaceHarness } from '../../../test-support/renderWorkspace.js'
import { act } from 'react-test-renderer'

const TOKEN='a'.repeat(43),SECOND='b'.repeat(43)
const expiration='2026-10-03T12:00:00.000Z'
async function setup(t,{purpose='activation',strict=false,api}={}){
  const h=await workspaceHarness(t),historyCalls=[],location={pathname:'/ativar-conta',search:'',hash:`#token=${TOKEN}`,key:'first'}
  h.localStorage.setItem=()=>assert.fail('challenge must never write persistent storage')
  h.sessionStorage.setItem=()=>assert.fail('challenge must never write persistent storage')
  const history={state:{key:'first'},replaceState(state,_title,url){historyCalls.push({state,url});location.hash=''}}
  const {useEmailChallenge}=await h.load('/src/domains/access/ui/useEmailChallenge.js')
  let current
  function Probe(props){const value=useEmailChallenge(props);React.useEffect(()=>{current=value});return React.createElement('p',null,value.error|| (value.ready?'ready':'pending'))}
  const original=api.inspectChallenge
  const guardedApi={...api,inspectChallenge(input){assert.ok(historyCalls.length>0,'history is cleared before inspection');return original(input)}}
  const props={expectedPurpose:purpose,api:guardedApi,location,history}
  const screen=await h.render(strict?StrictMode:Probe,strict?{children:React.createElement(Probe,props)}:props)
  return {h,screen,Probe,props,historyCalls,location,get current(){return current}}
}
test('opening a link scrubs history before inspection, stores nothing and never completes on GET',async t=>{
  const inspections=[],completions=[]
  const f=await setup(t,{api:{inspectChallenge:async input=>{inspections.push(input);return {purpose:'activation',expiresAt:expiration}},completeChallenge:async input=>completions.push(input)}})
  assert.equal(f.historyCalls.length,1);assert.equal(f.historyCalls[0].url.includes('#'),false)
  assert.equal(inspections.length,1);assert.equal(completions.length,0);assert.equal(f.current.ready,true)
  assert.equal(f.h.sessionStorage.length,0);assert.equal(f.h.localStorage.getItem('auth-token'),null)
  assert.equal('token' in f.current,false)
})
test('StrictMode effect replay retains the captured token and performs only one inspection',async t=>{
  let inspections=0,completed
  const f=await setup(t,{strict:true,api:{inspectChallenge:async()=>{inspections++;return {purpose:'activation',expiresAt:expiration}},completeChallenge:async body=>{completed=body;return {completed:true,purpose:'activation'}}}})
  assert.equal(inspections,1);assert.equal(f.current.ready,true)
  await act(async()=>f.current.complete('a synthetic new password'))
  assert.deepEqual(completed,{token:TOKEN,password:'a synthetic new password'})
  assert.equal(f.current.completed,true)
})
test('refresh without fragment asks to reopen the email and does not inspect',async t=>{
  const f=await setup(t,{api:{inspectChallenge:async()=>({purpose:'activation',expiresAt:expiration})}})
  await act(async()=>f.screen.update(React.createElement(f.Probe,{...f.props,location:{...f.location,key:'refreshed'}})))
  assert.equal(f.current.ready,false);assert.match(f.current.error,/Abra novamente.*e-mail/)
})
test('wrong-purpose link is unavailable and cannot be submitted',async t=>{
  const f=await setup(t,{api:{inspectChallenge:async()=>({purpose:'password_reset',expiresAt:expiration}),completeChallenge:()=>assert.fail('wrong purpose')}})
  assert.equal(f.current.ready,false);assert.match(f.current.error,/Link inválido/)
  assert.equal(await f.current.complete('a synthetic new password'),false)
})
test('old inspection after navigation cannot restore its token or update the new owner',async t=>{
  let oldResolve,completeCalls=0
  const api={inspectChallenge:body=>body.token===TOKEN?new Promise(r=>{oldResolve=r}):Promise.resolve({purpose:'activation',expiresAt:expiration}),completeChallenge:async body=>{completeCalls++;assert.equal(body.token,SECOND);return {completed:true,purpose:'activation'}}}
  const f=await setup(t,{api})
  await act(async()=>f.screen.update(React.createElement(f.Probe,{...f.props,location:{pathname:'/ativar-conta',search:'',hash:`#token=${SECOND}`,key:'second'}})))
  await act(async()=>oldResolve({purpose:'password_reset',expiresAt:expiration}))
  assert.equal(f.current.ready,true);assert.equal(f.current.error,'')
  await act(async()=>f.current.complete('a synthetic new password'))
  assert.equal(completeCalls,1)
})
test('old completion after navigation cannot report success for the newly opened link',async t=>{
  let finish,oldComplete
  const api={inspectChallenge:async()=>({purpose:'activation',expiresAt:expiration}),completeChallenge:()=>new Promise(r=>{finish=r})}
  const f=await setup(t,{api})
  await act(async()=>{oldComplete=f.current.complete('a synthetic new password')})
  await act(async()=>f.screen.update(React.createElement(f.Probe,{...f.props,location:{pathname:'/ativar-conta',search:'',hash:`#token=${SECOND}`,key:'second'}})))
  await act(async()=>finish({completed:true,purpose:'activation'}))
  assert.equal(await oldComplete,false);assert.equal(f.current.completed,false);assert.equal(f.current.ready,true)
})
