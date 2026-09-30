import { useRef, useState } from 'react'
import Button from '../../../shared/ui/Button'
import { accessApi } from '../infrastructure/accessApi.js'
import { useAccessRequest } from './useAccessRequest.js'
import './access.css'

export default function InvitationAccept({ api = accessApi, onLogin }) {
  const owner = useRef({}).current
  const { state, run, owns } = useAccessRequest(owner)
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const submit = async event => {
    event.preventDefault()
    if (state.pending) return
    await run(() => api.acceptInvitation({ token: token.trim(), password }), () => {
      if (!owns()) return
      setToken(''); setPassword(''); onLogin?.()
    })
  }
  return <main className="system-state-screen"><section className="surface-card access-section access-activation"><h1>Ativar conta</h1><p>Cole o token recebido para definir sua senha. Depois, entre com seu identificador e senha.</p>
    <form className="access-form" onSubmit={submit} aria-busy={Boolean(state.pending)}>
      <label>Token do convite<input name="token" autoComplete="off" required value={token} onChange={event => setToken(event.target.value)} /></label>
      <label>Nova senha<input name="password" type="password" autoComplete="new-password" required minLength={15} maxLength={1024} value={password} onChange={event => setPassword(event.target.value)} /></label>
      <Button type="submit" disabled={state.pending}>Definir senha</Button>
      <Button variant="secondary" disabled={state.pending} onClick={onLogin}>Voltar ao login</Button>
    </form>{state.error && <p role="alert">{state.error}</p>}</section></main>
}
