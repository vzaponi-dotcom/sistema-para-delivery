import { useRef, useState } from 'react'
import Button from '../../../shared/ui/Button'
import AccessAuthLayout from '../../../shared/ui/AccessAuthLayout'
import PasswordField from '../../../shared/ui/PasswordField'
import Icon from '../../../shared/ui/Icon'
import { accessApi } from '../infrastructure/accessApi.js'
import { useAccessRequest } from './useAccessRequest.js'
import './access.css'

export default function InvitationAccept({ api = accessApi, onLogin }) {
  const owner = useRef({}).current
  const { state, run, owns, patch } = useAccessRequest(owner)
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const submit = async event => {
    event.preventDefault()
    if (state.pending || state.accepted) return
    if (password !== confirmPassword) { patch({ error: 'As senhas não coincidem. Confira a confirmação.' }); return }
    await run(() => api.acceptInvitation({ token: token.trim(), password }), () => {
      if (!owns()) return
      setToken(''); setPassword(''); setConfirmPassword(''); patch({ accepted: true })
    })
  }
  return <AccessAuthLayout label="Ativação da conta">
    {state.accepted ? <>
      <div className="access-auth-success" role="status"><Icon name="check" />Conta ativada com sucesso</div>
      <h1>Tudo pronto para entrar</h1><p>Agora use seu <strong>usuário de acesso</strong> e a senha que acabou de criar. O usuário está no convite entregue pelo gerente.</p>
      <Button className="access-auth-submit" onClick={onLogin} type="button">Ir para o login</Button>
    </> : <>
      <div className="access-auth-copy"><span className="section-kicker">Primeiro acesso</span><h1>Ativar conta</h1><p>Use o código recebido do gerente e crie sua senha.</p></div>
      <form className="access-auth-form" onSubmit={submit} aria-busy={Boolean(state.pending)}>
        <label className="access-auth-field">Código do convite<input name="token" autoComplete="off" autoCapitalize="none" spellCheck={false} required value={token} disabled={state.pending} placeholder="Cole o código de ativação" onChange={event => setToken(event.target.value)} /><small>O código vale por 24 horas e só pode ser usado uma vez.</small></label>
        <PasswordField label="Crie sua senha" hint="Pelo menos 15 caracteres." name="password" autoComplete="new-password" required minLength={15} maxLength={1024} value={password} disabled={state.pending} onChange={event => setPassword(event.target.value)} />
        <PasswordField label="Confirme sua senha" name="confirmPassword" autoComplete="new-password" required maxLength={1024} value={confirmPassword} disabled={state.pending} onChange={event => setConfirmPassword(event.target.value)} />
        {state.error && <div className="login-error" role="alert">{state.error}</div>}
        <Button type="submit" className="access-auth-submit" disabled={state.pending}>{state.pending ? 'Ativando…' : 'Ativar minha conta'}</Button>
      </form><div className="access-auth-footer">Já ativou? <button type="button" className="access-auth-link" disabled={state.pending} onClick={onLogin}>Ir para o login</button></div>
    </>}
  </AccessAuthLayout>
}
