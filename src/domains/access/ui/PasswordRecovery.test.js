import test from 'node:test'
import assert from 'node:assert/strict'
import { setup, response, fill, submit, nodeText, act, buttonNamed } from '../../../test-support/accessUi.js'

test('recovery sends email once and shows the generic response without promising account existence',async t=>{
  const calls=[],login=[]
  const {screen,h}=await setup(t,'PasswordRecovery',{onLogin:()=>login.push(true)},async(url,options)=>{calls.push([url,JSON.parse(options.body)]);return response({message:'Se houver uma conta ativa com esse e-mail, enviaremos um link para redefinir sua senha.'})})
  await fill(screen,'email',' MARIA@EXAMPLE.TEST ');await submit(screen)
  assert.deepEqual(calls,[['/api/auth/password-recovery',{email:'maria@example.test'}]])
  assert.match(nodeText(screen.root),/Se houver uma conta ativa com esse e-mail, enviaremos um link para redefinir sua senha\./)
  assert.match(nodeText(screen.root),/spam/i);assert.equal(h.sessionStorage.length,0)
  await act(async()=>buttonNamed(screen.root,'Voltar ao login').props.onClick())
  assert.deepEqual(login,[true])
})
test('a delayed recovery response cannot update an unmounted screen',async t=>{
  let resolve
  const {screen}=await setup(t,'PasswordRecovery',{onLogin:()=>{}},()=>new Promise(r=>{resolve=r}))
  await fill(screen,'email','maria@example.test')
  await act(async()=>{screen.root.findByType('form').props.onSubmit({preventDefault(){}})})
  await act(async()=>screen.unmount())
  await act(async()=>resolve(response({message:'generic'})))
  assert.equal(screen.toJSON(),null)
})
