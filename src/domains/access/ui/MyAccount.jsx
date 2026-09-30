import { useState } from 'react'
import Button from '../../../shared/ui/Button'
import PageHeader from '../../../shared/ui/PageHeader'
import { accessApi } from '../infrastructure/accessApi.js'
import { useAccessRequest } from './useAccessRequest.js'
import './access.css'

const unavailableCredentialChange = async () => { throw new Error('Não foi possível confirmar o contexto da sessão. Entre novamente.') }
export default function MyAccount({ sessionContext, api = accessApi, runCredentialChange = unavailableCredentialChange, onApiError, writesBlocked = false }) {
  const { state, run, owns, patch } = useAccessRequest(sessionContext, onApiError)
  const [passwords, setPasswords] = useState({ owner: sessionContext, currentPassword: '', password: '' })
  const values = passwords.owner === sessionContext ? passwords : { currentPassword: '', password: '' }
  if (!sessionContext?.user?.id) return <p role="alert">Entre com sua conta individual.</p>
  const submit = async event => {
    event.preventDefault()
    if (writesBlocked || state.pending || !owns()) return
    await run(() => runCredentialChange(() => api.changePassword({ currentPassword: values.currentPassword, password: values.password })), result => {
      if (result?.changed !== true) throw new Error('Não foi possível confirmar a alteração da senha.')
      setPasswords({ owner: sessionContext, currentPassword: '', password: '' })
      patch({ notice: 'Senha alterada.' })
    })
  }
  return <div className="settings-page access-page"><PageHeader title="Minha conta" description={sessionContext.user.displayName} />
    <section className="surface-card access-section"><h2>Alterar minha senha</h2><p>Use ao menos 15 caracteres. As outras sessões desta conta serão encerradas.</p>
      <form className="access-form" onSubmit={submit} aria-busy={Boolean(state.pending)}>
        {['currentPassword', 'password'].map(name => <label key={name}>{name === 'currentPassword' ? 'Senha atual' : 'Nova senha'}<input name={name} type="password" required minLength={name === 'password' ? 15 : undefined} maxLength={1024} autoComplete={name === 'password' ? 'new-password' : 'current-password'} value={values[name]} onChange={event => setPasswords({ ...values, owner: sessionContext, [name]: event.target.value })} /></label>)}
        <Button type="submit" disabled={writesBlocked || state.pending}>Alterar senha</Button>
      </form>{state.error && <p role="alert">{state.error}</p>}{state.notice && <p role="status">{state.notice}</p>}
    </section></div>
}
