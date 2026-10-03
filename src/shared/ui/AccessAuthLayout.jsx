import Icon from './Icon'
import './access-auth.css'

export default function AccessAuthLayout({ children, label }) {
  return <main className="access-auth-screen"><div className="access-auth-layout">
    <aside className="access-auth-brand" aria-label="Mesiva">
      <img src="/brand/mesiva-logo-dark.svg" width="729" height="210" alt="Mesiva — Pessoas. Sabor. Evolução." />
      <div className="access-auth-story"><span>Pessoas. Sabor. Evolução.</span><h2>Sua equipe conectada.<br />Sua operação no ritmo certo.</h2><p>Do atendimento à gestão, cada pessoa com seu acesso à Mesiva.</p></div>
      <div className="access-auth-brand-footer"><Icon name="meal" size={18} />Gestão para restaurantes</div>
    </aside><section className="access-auth-content" aria-label={label}>{children}</section>
  </div></main>
}
