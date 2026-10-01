import { useState } from 'react'
import Button from '../../../shared/ui/Button'
import PageHeader from '../../../shared/ui/PageHeader'
import PasswordField from '../../../shared/ui/PasswordField'
import Icon from '../../../shared/ui/Icon'
import { accessApi } from '../infrastructure/accessApi.js'
import { useAccessRequest } from './useAccessRequest.js'
import './access.css'

const unavailableCredentialChange = async () => { throw new Error('Não foi possível confirmar o contexto da sessão. Entre novamente.') }
export default function MyAccount({ sessionContext, api = accessApi, runCredentialChange = unavailableCredentialChange, onApiError, writesBlocked = false }) {
  const { state, run, owns, patch } = useAccessRequest(sessionContext, onApiError)
  const [passwords, setPasswords] = useState({ owner: sessionContext, currentPassword: '', password: '', confirmPassword: '' })
  const values = passwords.owner === sessionContext ? passwords : { currentPassword: '', password: '', confirmPassword: '' }
  if (!sessionContext?.user?.id) return <p role="alert">Entre com sua conta individual.</p>
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
  return <div className="settings-page access-page"><PageHeader eyebrow="Sua conta" title="Minha conta" description="Seus dados de acesso e a segurança da sua conta." />
    <div className="access-account-grid"><section className="surface-card access-section access-identity-card"><span className="access-avatar">{sessionContext.user.displayName?.trim().slice(0, 2).toUpperCase()}</span><h2>{sessionContext.user.displayName}</h2><dl className="access-identity-data"><div><dt>Usuário de acesso</dt><dd>{sessionContext.user.identifier || 'Não informado'}</dd></div><div><dt>Perfil</dt><dd>{sessionContext.user.roleName || (sessionContext.user.roleId === 'manager' ? 'Gerente' : sessionContext.user.roleId === 'operator' ? 'Operador' : 'Não informado')}</dd></div></dl><p className="access-muted">Seu gerente administra o nome e o perfil de acesso.</p></section>
    <section className="surface-card access-section"><h2>Alterar minha senha</h2><p className="access-muted">Crie uma senha de pelo menos 15 caracteres.</p>
      <form className="access-form" onSubmit={submit} aria-busy={Boolean(state.pending)}>
        {['currentPassword', 'password', 'confirmPassword'].map(name => <PasswordField key={name} label={{ currentPassword: 'Senha atual', password: 'Nova senha', confirmPassword: 'Confirme a nova senha' }[name]} name={name} required minLength={name === 'password' ? 15 : undefined} maxLength={1024} disabled={writesBlocked || state.pending} autoComplete={name === 'currentPassword' ? 'current-password' : 'new-password'} value={values[name]} onChange={event => setPasswords({ ...values, owner: sessionContext, [name]: event.target.value })} />)}
        <p className="access-callout"><Icon name="shield" size={18} />Ao alterar a senha, as outras sessões desta conta serão encerradas. Você continua neste dispositivo.</p>
        <Button type="submit" disabled={writesBlocked || state.pending}>{state.pending ? 'Alterando…' : 'Alterar senha'}</Button>
      </form>{state.error && <p role="alert">{state.error}</p>}{state.notice && <p role="status">{state.notice}</p>}
    </section></div></div>
}
