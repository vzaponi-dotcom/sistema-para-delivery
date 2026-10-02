import { useEffect, useMemo, useRef, useState } from 'react'
import Button from '../../../shared/ui/Button.jsx'
import AccessAuthLayout from '../../../shared/ui/AccessAuthLayout.jsx'
import PasswordField from '../../../shared/ui/PasswordField.jsx'
import LoginScreen from '../../../app/shell/LoginScreen.jsx'
import { companiesApi } from '../infrastructure/companiesApi.js'
import './companies.css'

const invalid = 'Link inválido ou expirado. Solicite um novo convite.'
export default function CompanyInvitationAccept({ api = companiesApi, session, sessionChecking = false, loginError = '', loginPending = false, onLogin, onAccepted, onLogout, location = globalThis.window?.location, history = globalThis.window?.history }) {
  const route = `${location?.pathname || ''}:${location?.key || ''}`
  const capture = useRef(null)
  const owner = useMemo(() => ({}), [api, route, session?.contextId])
  const current = useRef(owner); current.current = owner
  const lock = useRef(null)
  const [state, setState] = useState({ owner, pending: true })
  const [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('')
  const visible = state.owner === owner ? state : { pending: true }
  useEffect(() => {
    let active = true
    if (capture.current?.route !== route) {
      capture.current = { route, token: '', error: '' }
      try {
        const params = new URLSearchParams((location?.hash || '').replace(/^#/, ''))
        const token = params.get('token')
        // Removal precedes every inspection; the token remains only in memory.
        if (location?.hash) {
          if (!history?.replaceState) throw new Error(invalid)
          const search = new URLSearchParams(location.search || ''); search.delete('token')
          history.replaceState(history.state ?? null, '', `${location.pathname}${search.size ? `?${search}` : ''}`)
        }
        if (params.size !== 1 || !/^[A-Za-z0-9_-]{43}$/.test(token || '')) throw new Error('Abra novamente o convite recebido por e-mail.')
        capture.current.token = token
      } catch (error) { capture.current.error = error.message }
    }
    const captured = capture.current
    const publish = value => { if (active && current.current === owner && capture.current === captured) setState({ owner, ...value }) }
    setPassword(''); setConfirmation('')
    if (captured.error || !captured.token) publish({ error: captured.error || invalid, pending: false })
    else {
      publish({ pending: true })
      void api.inspectInvitation({ token: captured.token }).then(value => {
        if (value?.purpose !== 'company_invitation' || !Number.isFinite(Date.parse(value.expiresAt))) throw new Error(invalid)
        publish({ invitation: value, pending: false })
      }).catch(error => publish({ pending: false, error: error?.message || invalid }))
    }
    return () => { active = false }
  }, [api, owner, route])
  const accept = async event => {
    event?.preventDefault?.()
    const invitation = visible.invitation
    if (!invitation || visible.pending || sessionChecking || lock.current || current.current !== owner) return
    if (invitation.requiresLogin && !session?.account?.id) return
    if (!invitation.requiresLogin && (password.length < 15 || password !== confirmation)) { setState(previous => ({ ...previous, error: 'Crie uma senha de pelo menos 15 caracteres e confira a confirmação.' })); return }
    const operation = {}; lock.current = operation
    setState(previous => ({ ...previous, pending: true, error: '' }))
    try {
      const result = await api.acceptInvitation({ token: capture.current.token, ...(!invitation.requiresLogin ? { password } : {}) }, session)
      if (current.current !== owner) return
      if (result?.accepted !== true) throw new Error('Não foi possível confirmar o aceite. Reabra o link antes de tentar novamente.')
      capture.current.token = ''; setPassword(''); setConfirmation('')
      setState({ owner, accepted: true, pending: false })
    } catch (error) { if (current.current === owner) setState(previous => ({ ...previous, pending: false, error: error?.message || invalid })) }
    finally { if (lock.current === operation) lock.current = null }
  }
  if (visible.invitation?.requiresLogin && !session?.account?.id && !sessionChecking) return <>
    <div className="company-invite-login-note"><strong>Convite para {visible.invitation.businessName}</strong><p>Entre com o e-mail que recebeu o convite. Sua senha atual será mantida.</p></div>
    <LoginScreen authMode="multi_company" onLogin={onLogin} error={loginError} loading={loginPending} />
  </>
  return <AccessAuthLayout label="Convite para uma empresa">
    <div className="access-auth-copy"><span className="section-kicker">Sua equipe na Mesiva</span><h1>{visible.accepted ? 'Acesso confirmado' : 'Você recebeu um convite'}</h1></div>
    {visible.accepted ? <><p>Seu acesso à empresa foi confirmado.{session?.account?.id ? ' Sua empresa atual continua aberta. Escolha a nova empresa quando quiser.' : ' Agora entre com seu e-mail e a senha que criou.'}</p><Button onClick={onAccepted}>Continuar</Button></> : <>
      {(visible.pending && !visible.invitation || sessionChecking) && <p role="status">Verificando seu acesso…</p>}
      {visible.invitation && !sessionChecking && <><div className="company-invitation-summary"><strong>{visible.invitation.businessName}</strong><span>Seu perfil: {visible.invitation.roleName}</span></div>
        {visible.invitation.requiresLogin ? <><p>Você está conectado como <strong>{session?.account?.email}</strong>. Confirme se este é o e-mail que recebeu o convite.</p><Button onClick={accept} disabled={visible.pending}>Aceitar convite</Button>{onLogout && <Button variant="secondary" onClick={onLogout} disabled={visible.pending}>Entrar com outra conta</Button>}</> : <form className="access-auth-form" onSubmit={accept}>
          <p>Crie sua senha para confirmar o e-mail e participar desta empresa.</p><PasswordField label="Crie sua senha" name="password" minLength={15} required autoComplete="new-password" value={password} disabled={visible.pending} onChange={event => setPassword(event.target.value)} /><PasswordField label="Confirme sua senha" name="confirmPassword" required autoComplete="new-password" value={confirmation} disabled={visible.pending} onChange={event => setConfirmation(event.target.value)} /><Button type="submit" disabled={visible.pending}>Ativar conta e aceitar convite</Button>
        </form>}</>}
    </>}
    {visible.error && <p role="alert" className="login-error">{visible.error}</p>}
  </AccessAuthLayout>
}
