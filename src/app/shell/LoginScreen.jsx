import { useState } from 'react'
import Button from '../../shared/ui/Button'
import AccessAuthLayout from '../../shared/ui/AccessAuthLayout'
import PasswordField from '../../shared/ui/PasswordField'

function LoginScreen({ onLogin, authMode = null, loading = false, error = '', disabled = false }) {
  const [pin, setPin] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [personal, setPersonal] = useState(false)
  const [legacySelected, setLegacySelected] = useState(authMode === 'legacy')
  const pinLogin = authMode === 'legacy' || (authMode === 'enrollment' && legacySelected)

  const handleSubmit = async (event) => {
    event.preventDefault()
    const value = pinLogin ? pin.trim() : { identifier: identifier.trim(), password, deviceMode: personal ? 'personal' : 'shared' }
    if ((pinLogin ? !value : !value.identifier || !password) || loading || disabled) return
    setPin('')
    setPassword('')
    await onLogin(value)
  }

  return (
    <AccessAuthLayout label="Entrar na Mesiva">
        <div className="access-auth-copy">
          <span className="section-kicker">Sua operação começa aqui</span>
          <h1 id="login-title">Entrar na Mesiva</h1>
          <p>{pinLogin ? 'Informe o PIN da operação.' : 'Use o usuário de acesso criado pelo gerente.'}</p>
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
            <label className="access-auth-field"><span>Usuário de acesso</span><input autoFocus autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Ex.: ana.atendimento" value={identifier} onChange={(event) => setIdentifier(event.target.value)} disabled={loading || disabled} aria-describedby="login-identifier-hint" /><small id="login-identifier-hint">É o identificador informado no convite, não o código de ativação.</small></label>
            <PasswordField label="Senha" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading || disabled} />
            <label className="access-auth-personal"><input type="checkbox" checked={personal} onChange={(event) => setPersonal(event.target.checked)} disabled={loading || disabled} /><span>Este dispositivo é só meu<small>{personal ? 'Sessão de até sete dias.' : 'Dispositivo compartilhado: sessão de até 12 horas.'}</small></span></label>
          </>}
          {authMode === 'enrollment' && <Button type="button" variant="secondary" onClick={() => { setLegacySelected((value) => !value); setPassword(''); setPin('') }}>{pinLogin ? 'Entrar com minha conta' : 'Entrar com PIN da operação'}</Button>}

          {error && <div className="login-error" role="alert">{error}</div>}

          <Button type="submit" className="access-auth-submit" disabled={(pinLogin ? !pin.trim() : !identifier.trim() || !password) || loading || disabled}>
            {loading ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
        {authMode !== 'legacy' && <><div className="access-auth-footer">Primeiro acesso? <a href="/ativar-conta">Tenho um convite</a></div><p className="access-auth-help">Esqueceu a senha? Peça um novo convite ao gerente.</p></>}
    </AccessAuthLayout>
  )
}

export default LoginScreen
