import Button from '../../../shared/ui/Button.jsx'
import Icon from '../../../shared/ui/Icon.jsx'
import './companies.css'

export default function CompanySelection({ account, items = [], currentBusinessId, onSelect, onLogout, onCancel, onPlatform, onAccount, pending = false, loading = false, error, onRetry }) {
  return <main className="company-entry">
    <header className="company-entry-header"><img src="/brand/mesiva-logo.svg" alt="Mesiva" width="160" height="52" /><Button variant="secondary" onClick={onLogout} disabled={pending}>Sair da conta</Button></header>
    <section className="company-selection" aria-labelledby="company-selection-title" aria-busy={pending || loading}>
      <span className="section-kicker">Sua operação</span><h1 id="company-selection-title">Qual empresa você quer abrir?</h1>
      <p>{account?.displayName ? `Olá, ${account.displayName}. ` : ''}Escolha onde vai trabalhar agora.</p>
      {account?.email && <p className="company-account-email">{account.email}</p>}
      {error && <div role="alert" className="company-feedback"><p>{error}</p>{onRetry && <Button variant="secondary" onClick={onRetry} disabled={pending}>Tentar novamente</Button>}</div>}
      {loading ? <p role="status">Carregando suas empresas…</p> : items.length ? <div className="company-selection-grid">
        {items.map(item => <button type="button" key={item.businessId} className="company-selection-card" aria-label={`Abrir ${item.name}`} disabled={pending} onClick={() => onSelect?.(item.businessId)}>
          <span className="company-selection-icon"><Icon name="orders" size={24} /></span><span><strong>{item.name}</strong><small>{item.roleName}</small>{item.businessId === currentBusinessId && <small className="company-current">Empresa atual</small>}</span><Icon name="arrow-right" size={18} />
        </button>)}
      </div> : !error && <section className="company-empty"><Icon name="clients" size={32} /><h2>Nenhuma empresa disponível</h2><p>Peça um convite ao gerente e abra o link recebido por e-mail. Se já aceitou, atualize sua lista.</p>{onRetry && <Button onClick={onRetry} disabled={pending}>Atualizar empresas</Button>}</section>}
      <div className="company-entry-actions">{onCancel && <Button variant="secondary" onClick={onCancel} disabled={pending}>Voltar à operação</Button>}{onAccount && <Button variant="secondary" onClick={onAccount} disabled={pending}>Minha conta</Button>}{onPlatform && <Button variant="secondary" onClick={onPlatform} disabled={pending}>Administração Mesiva</Button>}</div>
      {pending && <p role="status">Confirmando seu acesso…</p>}
    </section>
  </main>
}
