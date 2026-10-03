import { useState } from 'react'
import Button from '../../../shared/ui/Button'
import AccessAuthLayout from '../../../shared/ui/AccessAuthLayout'
import PasswordField from '../../../shared/ui/PasswordField'
import Icon from '../../../shared/ui/Icon'
import { accessApi } from '../infrastructure/accessApi.js'
import { useEmailChallenge } from './useEmailChallenge.js'
import './access.css'

export default function InvitationAccept({api=accessApi,onLogin,expectedPurpose='activation',location,history}) {
  const challenge=useEmailChallenge({api,expectedPurpose,location,history})
  const [passwords,setPasswords]=useState({owner:null,password:'',confirmPassword:''})
  const owner=challenge.owner
  const values=passwords.owner===owner?passwords:{password:'',confirmPassword:''}
  const [confirmation,setConfirmation]=useState({owner,error:''})
  const reset=expectedPurpose==='password_reset'
  const submit=async event=>{
    event.preventDefault()
    if(challenge.pending||!challenge.ready)return
    if(values.password!==values.confirmPassword){setConfirmation({owner,error:'As senhas não coincidem. Confira a confirmação.'});return}
    setConfirmation({owner,error:''})
    const result=await challenge.complete(values.password)
    if(result)setPasswords({owner,password:'',confirmPassword:''})
  }
  const error=challenge.error || (confirmation.owner===owner?confirmation.error:'')
  return <AccessAuthLayout label={reset?'Redefinir senha':'Ativação da conta'}>
    {challenge.completed?<>
      <div className="access-auth-success" role="status"><Icon name="check" />{reset?'Senha atualizada. Entre com sua nova senha.':'Conta ativada com sucesso'}</div>
      <h1>{reset?'Sua senha foi atualizada':'Tudo pronto para entrar'}</h1>
      <p>{reset?'As sessões anteriores desta conta foram encerradas.':'Agora use seu e-mail e a senha que acabou de criar para entrar na Mesiva.'}</p>
      <Button className="access-auth-submit" type="button" onClick={onLogin}>Ir para o login</Button>
    </>:<>
      <div className="access-auth-copy"><span className="section-kicker">{reset?'Segurança da sua conta':'Primeiro acesso'}</span><h1>{reset?'Criar nova senha':'Ativar conta'}</h1><p>{reset?'Crie uma nova senha para voltar a acessar sua conta.':'Crie sua senha para confirmar seu e-mail e acessar a Mesiva.'}</p></div>
      {challenge.pending&&!challenge.ready&&<p role="status">Verificando seu link…</p>}
      {challenge.ready&&<form className="access-auth-form" onSubmit={submit} aria-busy={Boolean(challenge.pending)}>
        <PasswordField label={reset?'Nova senha':'Crie sua senha'} hint="Pelo menos 15 caracteres." name="password" autoComplete="new-password" required minLength={15} maxLength={1024} value={values.password} disabled={challenge.pending} onChange={event=>setPasswords({...values,owner,password:event.target.value})} />
        <PasswordField label="Confirme sua senha" name="confirmPassword" autoComplete="new-password" required maxLength={1024} value={values.confirmPassword} disabled={challenge.pending} onChange={event=>setPasswords({...values,owner,confirmPassword:event.target.value})} />
        <p className="access-auth-help">{reset?'Ao salvar, as sessões anteriores desta conta serão encerradas.':'O convite vale por 24 horas e só pode ser usado uma vez.'}</p>
        {error&&<div className="login-error" role="alert">{error}</div>}
        <Button type="submit" className="access-auth-submit" disabled={challenge.pending}>{challenge.pending?'Salvando…':reset?'Salvar nova senha':'Ativar minha conta'}</Button>
      </form>}
      {!challenge.ready&&error&&<div className="login-error" role="alert">{error}</div>}
      <div className="access-auth-footer"><button type="button" className="access-auth-link" onClick={onLogin}>Ir para o login</button>{reset&&<a href="/recuperar-senha">Solicitar outro link</a>}</div>
    </>}
  </AccessAuthLayout>
}