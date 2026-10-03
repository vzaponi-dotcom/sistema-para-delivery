import { useContextApi } from '../../../infrastructure/api/ContextApi.js'
import { useState } from 'react'
import Button from '../../../shared/ui/Button'
import PageHeader from '../../../shared/ui/PageHeader'
import PasswordField from '../../../shared/ui/PasswordField'
import Icon from '../../../shared/ui/Icon'
import { accessApi, createAccessApi } from '../infrastructure/accessApi.js'
import { useAccessRequest } from './useAccessRequest.js'
import './access.css'

const unavailableCredentialChange = async () => { throw new Error('Não foi possível confirmar o contexto da sessão. Entre novamente.') }
export default function MyAccount({ sessionContext, api: suppliedApi = accessApi, runCredentialChange = unavailableCredentialChange, onApiError, writesBlocked = false }) {
  const api = useContextApi(createAccessApi, suppliedApi, accessApi)
  const { state, run, owns, patch } = useAccessRequest(sessionContext, onApiError)
  const [passwords, setPasswords] = useState({ owner: sessionContext, currentPassword: '', password: '', confirmPassword: '' })
  const values = passwords.owner === sessionContext ? passwords : { currentPassword: '', password: '', confirmPassword: '' }
  const person = sessionContext?.account || sessionContext?.user
  if (!person?.id) return <p role="alert">Entre com sua conta individual.</p>
  const submit = async event => {
    event.preventDefault()
    if (writesBlocked || state.pending || !owns()) return
    if (values.password !== values.confirmPassword) { patch({ error: 'As senhas não coincidem. Confira a confirmação.' }); return }
    await run(() => runCredentialChange(() => api.changePassword({ currentPassword: values.currentPassword, password: values.password })), result => {
      if (result?.changed !== true) throw new Error('Não foi possível confirmar a alteração da senha.')
      setPasswords({ owner: sessionContext, currentPassword: '', password: '', confirmPassword: '' })
      patch({ notice: 'Senha alterada.' })
    })
  }
  const roleName = sessionContext.user?.roleName || (sessionContext.user?.roleId === 'manager' ? 'Gerente' : sessionContext.user?.roleId === 'operator' ? 'Operador' : 'Sem empresa selecionada')
  const globalAccount = Boolean(sessionContext.account)
  return <div className="settings-page access-page"><PageHeader eyebrow="Sua conta" title="Minha conta" description="Seus dados de acesso e a segurança da sua conta." />
    <div className="access-account-grid">
      <section className="surface-card access-section access-identity-card access-identity-summary">
        <span className="access-avatar">{person.displayName?.trim().slice(0, 2).toUpperCase()}</span>
        <div className="access-identity-summary-copy">
          <h2>{person.displayName}</h2>
          {person.email && <p className="access-identity-email">{person.email}</p>}
          <span className="access-role-badge">{roleName}</span>
        </div>
      </section>
      <section className="surface-card access-section access-security-card">
        <header className="access-security-heading">
          <span className="access-security-icon" aria-hidden="true"><Icon name="shield" size={22} /></span>
          <div><h2>Senha e segurança</h2><p className="access-muted">Crie uma senha forte com pelo menos 15 caracteres.</p></div>
        </header>
        <form className="access-form" onSubmit={submit} aria-busy={Boolean(state.pending)}>
          {['currentPassword', 'password', 'confirmPassword'].map(name => <PasswordField key={name} label={{ currentPassword: 'Senha atual', password: 'Nova senha', confirmPassword: 'Confirme a nova senha' }[name]} name={name} required minLength={name === 'password' ? 15 : undefined} maxLength={1024} disabled={writesBlocked || state.pending} autoComplete={name === 'currentPassword' ? 'current-password' : 'new-password'} value={values[name]} onChange={event => setPasswords({ ...values, owner: sessionContext, [name]: event.target.value })} />)}
          <div className="access-callout"><Icon name="shield" size={20} /><span><strong>{globalAccount ? 'A senha será alterada para todas as empresas.' : 'A senha será alterada para esta conta.'}</strong><small>{globalAccount ? 'As outras sessões serão encerradas. Este dispositivo continua conectado se seu acesso ainda estiver ativo.' : 'As outras sessões desta conta serão encerradas. Você continua neste dispositivo.'}</small></span></div>
          <Button className="access-password-submit" type="submit" disabled={writesBlocked || state.pending}>{state.pending ? 'Alterando…' : 'Alterar senha'}</Button>
        </form>{state.error && <p role="alert">{state.error}</p>}{state.notice && <p role="status">{state.notice}</p>}
      </section>
    </div>
  </div>
}
