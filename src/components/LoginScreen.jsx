import { useState } from 'react'
import BrandLogo from './BrandLogo'
import Button from './Button'

function LoginScreen({ onLogin, loading = false, error = '', disabled = false }) {
  const [pin, setPin] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    const value = pin.trim()
    if (!value || loading || disabled) return
    setPin('')
    await onLogin(value)
  }

  return (
    <main className="login-screen">
      <section className="login-card" aria-labelledby="login-title">
        <BrandLogo className="login-brand" />
        <div className="login-copy">
          <span className="section-kicker">Acesso à operação</span>
          <h1 id="login-title">Entrar no sistema</h1>
          <p>Informe o PIN da Amor &amp; Sabor para acessar os dados compartilhados do delivery.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="form-field">
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
          </label>

          {error && <div className="login-error" role="alert">{error}</div>}

          <Button type="submit" disabled={!pin.trim() || loading || disabled}>
            {loading ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
      </section>
    </main>
  )
}

export default LoginScreen
