import test from 'node:test'
import assert from 'node:assert/strict'
import { setup, response, fill, submit, nodeText, act, buttonNamed } from '../../../test-support/accessUi.js'
const token='a'.repeat(43)
const props=purpose=>({expectedPurpose:purpose,location:{pathname:purpose==='activation'?'/ativar-conta':'/redefinir-senha',search:'',hash:`#token=${token}`},history:{replaceState(){}}})
for(const purpose of ['activation','password_reset'])test(`${purpose} inspects an email link, checks confirmation and completes without logging in`,async t=>{
  const calls=[],login=[]
  const {screen,h}=await setup(t,'InvitationAccept',{...props(purpose),onLogin:()=>login.push(true)},async(url,options)=>{
    calls.push([url,JSON.parse(options.body)])
    return response(url.endsWith('/inspect')?{purpose,expiresAt:'2026-10-03T12:00:00.000Z'}:{completed:true,purpose})
  })
  assert.equal(screen.root.findAllByType('input').some(n=>n.props.name==='token'),false)
  assert.equal(calls.length,1)
  await fill(screen,'password','a synthetic new password');await fill(screen,'confirmPassword','different');await submit(screen)
  assert.match(nodeText(screen.root),/senhas não coincidem/);assert.equal(calls.length,1)
  await fill(screen,'confirmPassword','a synthetic new password');await submit(screen)
  assert.deepEqual(calls[1],['/api/auth/email-challenges/complete',{token,password:'a synthetic new password'}])
  assert.deepEqual(login,[]);assert.equal(h.sessionStorage.length,0)
  if(purpose==='password_reset')assert.match(nodeText(screen.root),/Senha atualizada\. Entre com sua nova senha\./)
  else assert.match(nodeText(screen.root),/Conta ativada/)
  await act(async()=>buttonNamed(screen.root,'Ir para o login').props.onClick())
  assert.deepEqual(login,[true]);assert.doesNotMatch(nodeText(screen.root),new RegExp(token))
})
test('missing links offer clear guidance without a manual token input',async t=>{
  const {screen}=await setup(t,'InvitationAccept',{location:{pathname:'/ativar-conta',search:'',hash:''},history:{replaceState(){}},onLogin:()=>{}},()=>assert.fail('missing token fetch'))
  assert.match(nodeText(screen.root),/Abra novamente.*e-mail/)
  assert.equal(screen.root.findAllByType('form').length,0)
})
