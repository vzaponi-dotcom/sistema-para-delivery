import { useState } from 'react'
import Button from '../../../shared/ui/Button.jsx'
import Icon from '../../../shared/ui/Icon.jsx'
import './companies.css'

const connectors = new Set(['e', 'da', 'das', 'de', 'do', 'dos'])
const initials = (value) => {
  const parts = String(value || '').trim().split(/\s+/u)
    .map(part => part.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
    .filter(part => !connectors.has(part.toLocaleLowerCase('pt-BR')))
  if (!parts.length) return 'EM'
  if (parts.length === 1) return [...parts[0]].slice(0, 2).join('').toLocaleUpperCase('pt-BR')
  return `${[...parts[0]][0]}${[...parts.at(-1)][0]}`.toLocaleUpperCase('pt-BR')
}
const logoUrl = (item) => item?.hasLogo && item?.logoVersion
  ? `/api/auth/business-logo?businessId=${encodeURIComponent(item.businessId)}&v=${encodeURIComponent(item.logoVersion)}`
  : null

function CompanyMark({ item }) {
  const [failed, setFailed] = useState(false)
  const src = failed ? null : logoUrl(item)
  return <span className="company-selection-mark" aria-hidden="true">
    {src
      ? <img src={src} alt="" onError={() => setFailed(true)} />
      : <span>{initials(item?.name)}</span>}
  </span>
}

export default function CompanySelection({ account, items = [], currentBusinessId, onSelect, onLogout, onCancel, onPlatform, onAccount, pending = false, loading = false, error, onRetry }) {
  const accountName = account?.displayName?.trim()
  const accountEmail = account?.email?.trim()
  const accountInitials = initials(accountName || accountEmail)
  return <main className="company-entry">
    <header className="company-entry-header">
      <img src="/brand/mesiva-logo.svg" alt="Mesiva" width="160" height="52" />
      <Button variant="secondary" icon="logout" onClick={onLogout} disabled={pending}>Sair da conta</Button>
    </header>
    <section className="company-selection" aria-labelledby="company-selection-title" aria-busy={pending || loading}>
      {(accountName || accountEmail) && <div className="company-account-summary">
        <span className="company-account-avatar" aria-hidden="true">{accountInitials}</span>
        <span className="company-account-copy">
          <strong>{accountEmail || accountName}</strong>
          {accountName && accountEmail && <small>{accountName}</small>}
        </span>
      </div>}

      <div className="company-selection-heading">
        <span className="section-kicker">Suas empresas</span>
        <h1 id="company-selection-title">Qual empresa você quer abrir?</h1>
        <p>Escolha onde vai trabalhar agora.</p>
      </div>

      {error && <div role="alert" className="company-feedback"><p>{error}</p>{onRetry && <Button variant="secondary" onClick={onRetry} disabled={pending}>Tentar novamente</Button>}</div>}
      {loading ? <p role="status">Carregando suas empresas…</p> : items.length ? <div className="company-selection-grid">
        {items.map(item => <button type="button" key={item.businessId} className={`company-selection-card${item.businessId === currentBusinessId ? ' is-current' : ''}`} aria-label={`Abrir ${item.name}`} aria-current={item.businessId === currentBusinessId ? 'true' : undefined} disabled={pending} onClick={() => onSelect?.(item.businessId)}>
          <CompanyMark item={item} />
          <span className="company-selection-card-copy">
            <strong>{item.name}</strong>
            <small className="company-role">{item.roleName}</small>
          </span>
          <span className="company-selection-open" aria-hidden="true"><Icon name="arrow-right" size={20} /></span>
        </button>)}
      </div> : !error && <section className="company-empty"><Icon name="clients" size={32} /><h2>Nenhuma empresa disponível</h2><p>Peça um convite ao gerente e abra o link recebido por e-mail. Se já aceitou, atualize sua lista.</p>{onRetry && <Button onClick={onRetry} disabled={pending}>Atualizar empresas</Button>}</section>}

      <div className="company-entry-actions">
        {onAccount && <button type="button" className="company-entry-link" onClick={onAccount} disabled={pending}><Icon name="client" size={20} /><span>Minha conta</span><Icon name="arrow-right" size={18} /></button>}
        {onCancel && <button type="button" className="company-entry-link" onClick={onCancel} disabled={pending}><Icon name="arrow-left" size={20} /><span>Voltar à operação</span><Icon name="arrow-right" size={18} /></button>}
        {onPlatform && <button type="button" className="company-entry-link" onClick={onPlatform} disabled={pending}><Icon name="details" size={20} /><span>Administração Mesiva</span><Icon name="arrow-right" size={18} /></button>}
      </div>
      {pending && <p role="status">Confirmando seu acesso…</p>}
    </section>
  </main>
}
