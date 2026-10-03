import './startup-screen.css'

export default function StartupScreen({ message = 'Preparando sua operação…' }) {
  return <main className="startup-screen" role="status" aria-live="polite" aria-label="Carregando Mesiva">
    <div className="startup-brand" aria-hidden="true">
      <div className="startup-symbol-wrap">
        <span className="startup-halo" />
        <svg className="startup-symbol" viewBox="0 0 226 210">
          <image href="/brand/mesiva-logo.svg" width="729" height="210" />
        </svg>
      </div>
      <div className="startup-signature">
        <svg className="startup-wordmark" viewBox="260 50 475 115">
          <image className="startup-wordmark-light" href="/brand/mesiva-logo.svg" width="729" height="210" />
          <image className="startup-wordmark-dark" href="/brand/mesiva-logo-dark.svg" width="729" height="210" />
        </svg>
        <p className="startup-tagline">Pessoas. Sabor. Evolução.</p>
      </div>
    </div>
    <div className="startup-loading">
      <p>{message}</p>
      <span className="startup-loading-track" aria-hidden="true"><span className="startup-loading-indicator" /></span>
    </div>
  </main>
}
