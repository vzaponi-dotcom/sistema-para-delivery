import { useState } from 'react'
import Button from '../../shared/ui/Button'
import Icon from '../../shared/ui/Icon'

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
    <main className="login-screen">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-product-brand" aria-label="Mesiva">
          <span className="login-product-brand-icon" aria-hidden="true"><Icon name="meal" size={24} /></span>
          <strong>Mesiva</strong>
        </div>
        <div className="login-copy">
          <span className="section-kicker">Acesso à operação</span>
          <h1 id="login-title">Entrar no sistema</h1>
          <p>{pinLogin ? 'Informe o PIN da operação.' : 'Informe seu identificador e sua senha.'}</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {pinLogin ? <label className="form-field">
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
            <label className="form-field"><span>Identificador</span><input autoFocus autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} disabled={loading || disabled} /></label>
            <label className="form-field"><span>Senha</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading || disabled} /></label>
            <label><input type="checkbox" checked={personal} onChange={(event) => setPersonal(event.target.checked)} disabled={loading || disabled} /> Dispositivo pessoal</label>
            <p>{personal ? 'Sua sessão dura até sete dias.' : 'Dispositivo compartilhado: sua sessão dura até 12 horas.'}</p>
          </>}
          {authMode === 'enrollment' && <Button type="button" variant="secondary" onClick={() => { setLegacySelected((value) => !value); setPassword(''); setPin('') }}>{pinLogin ? 'Entrar com minha conta' : 'Entrar com PIN da operação'}</Button>}

          {error && <div className="login-error" role="alert">{error}</div>}

          <Button type="submit" disabled={(pinLogin ? !pin.trim() : !identifier.trim() || !password) || loading || disabled}>
            {loading ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
      </section>
    </main>
  )
}

export default LoginScreen
