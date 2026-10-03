import { useState } from 'react'
import Button from '../../../shared/ui/Button'
import AccessAuthLayout from '../../../shared/ui/AccessAuthLayout'
import Icon from '../../../shared/ui/Icon'
import { accessApi } from '../infrastructure/accessApi.js'
import { useAccessRequest } from './useAccessRequest.js'

export default function PasswordRecovery({api=accessApi,onLogin}) {
  const [owner]=useState(()=>({}))
  const {state,run,patch}=useAccessRequest(owner)
  const [email,setEmail]=useState('')
  const submit=async event=>{
    event.preventDefault()
    if(state.pending||state.sent)return
    await run(()=>api.recoverPassword({email:email.trim().toLowerCase()}),()=>{setEmail('');patch({sent:true})})
  }
  return <AccessAuthLayout label="Recuperar senha">
    <div className="access-auth-copy"><span className="section-kicker">Segurança da sua conta</span><h1>Recuperar senha</h1><p>Informe o e-mail que você usa para entrar na Mesiva.</p></div>
    {state.sent?<><div className="access-auth-success" role="status"><Icon name="check" />Se houver uma conta ativa com esse e-mail, enviaremos um link para redefinir sua senha.</div><p>Confira sua caixa de entrada e a pasta de spam. O link vale por 30 minutos. Use o e-mail mais recente.</p></>:<form className="access-auth-form" onSubmit={submit} aria-busy={Boolean(state.pending)}>
      <label className="access-auth-field">E-mail<input name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} value={email} disabled={state.pending} placeholder="voce@exemplo.com" onChange={event=>setEmail(event.target.value)} /></label>
      {state.error&&<div className="login-error" role="alert">{state.error}</div>}
      <Button className="access-auth-submit" type="submit" disabled={state.pending||!email.trim()}>{state.pending?'Solicitando…':'Enviar link de recuperação'}</Button>
    </form>}
    <div className="access-auth-footer"><button className="access-auth-link" type="button" onClick={onLogin}>Voltar ao login</button></div>
  </AccessAuthLayout>
}
