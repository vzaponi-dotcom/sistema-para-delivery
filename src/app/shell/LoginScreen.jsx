import { useState } from 'react'
import Button from '../../shared/ui/Button'
import AccessAuthLayout from '../../shared/ui/AccessAuthLayout'
import PasswordField from '../../shared/ui/PasswordField'

function LoginScreen({ onLogin, authMode = null, loading = false, error = '', disabled = false }) {
  const [pin, setPin] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [personal, setPersonal] = useState(false)
  const [legacySelected, setLegacySelected] = useState(authMode === 'legacy')
  const pinLogin = authMode === 'legacy' || (authMode === 'enrollment' && legacySelected)

  const handleSubmit = async (event) => {
    event.preventDefault()
    const value = pinLogin ? pin.trim() : { email: email.trim().toLowerCase(), password, deviceMode: personal ? 'personal' : 'shared' }
    if ((pinLogin ? !value : !value.email || !password) || loading || disabled) return
    setPin('')
    setPassword('')
    await onLogin(value)
  }

  return (
    <AccessAuthLayout label="Entrar na Mesiva">
        <div className="access-auth-copy">
          <span className="section-kicker">Sua operação começa aqui</span>
          <h1 id="login-title">Entrar na Mesiva</h1>
          <p>{pinLogin ? 'Informe o PIN da operação.' : 'Entre com seu e-mail e sua senha.'}</p>
        </div>

        <form className="access-auth-form" onSubmit={handleSubmit} aria-busy={loading}>
          {pinLogin ? <label className="access-auth-field">
            <span>PIN</span>
            <input
              autoFocus
              autoComplete="current-password"
              inputMode="numeric"
              type="password"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              placeholder="Digite o PIN"
              disabled={loading || disabled}
            />
          </label> : <>
            <label className="access-auth-field"><span>E-mail</span><input autoFocus name="email" type="email" inputMode="email" maxLength={254} autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="voce@exemplo.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={loading || disabled} aria-describedby="login-email-hint" /><small id="login-email-hint">Use o e-mail confirmado na ativação da conta.</small></label>
            <PasswordField label="Senha" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading || disabled} />
            <label className="access-auth-personal"><input type="checkbox" checked={personal} onChange={(event) => setPersonal(event.target.checked)} disabled={loading || disabled} /><span>Este dispositivo é só meu<small>{personal ? 'Sessão de até sete dias.' : 'Dispositivo compartilhado: sessão de até 12 horas.'}</small></span></label>
          </>}
          {authMode === 'enrollment' && <Button type="button" variant="secondary" onClick={() => { setLegacySelected((value) => !value); setPassword(''); setPin('') }}>{pinLogin ? 'Entrar com minha conta' : 'Entrar com PIN da operação'}</Button>}

          {error && <div className="login-error" role="alert">{error}</div>}

          <Button type="submit" className="access-auth-submit" disabled={(pinLogin ? !pin.trim() : !email.trim() || !password) || loading || disabled}>
            {loading ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
        {authMode !== 'legacy' && <><div className="access-auth-footer"><a href="/recuperar-senha">Esqueci minha senha</a></div><div className="access-auth-footer">Primeiro acesso? <a href="/ativar-conta">Tenho um convite</a></div><p className="access-auth-help">Abra o convite recebido por e-mail para ativar sua conta.</p></>}
    </AccessAuthLayout>
  )
}

export default LoginScreen
