import Button from '../../../shared/ui/Button.jsx'
import './platform.css'
export default function PlatformShell({ account, onLogout, onSelectBusiness, onAccount, pending = false, children }) {
  return <div className="platform-shell"><header className="platform-topbar"><div><img src="/brand/mesiva-logo.svg" alt="Mesiva" width="144" height="46" /><span>Administração Mesiva</span></div><div className="platform-account-actions"><span>{account?.displayName}<small>{account?.email}</small></span>{onSelectBusiness && <Button variant="secondary" disabled={pending} onClick={onSelectBusiness}>Minhas empresas</Button>}{onAccount && <Button variant="secondary" disabled={pending} onClick={onAccount}>Minha conta</Button>}<Button variant="secondary" disabled={pending} onClick={onLogout}>Sair</Button></div></header><main className="platform-content">{children}</main></div>
}
