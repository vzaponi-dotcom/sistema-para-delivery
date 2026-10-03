import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '../../shared/ui/Icon'
import Modal from '../../shared/ui/Modal'
import BottomSheet from '../../shared/ui/BottomSheet'
import { useMediaQuery } from '../../shared/hooks/useMediaQuery.js'
import { resolveNavigationEntry } from '../navigation/resolution.js'
import { useNavigation } from '../navigation/NavigationContext.jsx'
import { CURRENT_RELEASE } from '../notifications/notificationCatalog.js'
import OperationLogo from './OperationLogo.jsx'

const formatReleaseDate = (value) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value))
const INITIAL_CONNECTORS = new Set(['e', 'da', 'das', 'de', 'do', 'dos'])

const normalizeOperationName = (value) => String(value || '').trim().replace(/\s+/g, ' ') || 'Operação'
const operationInitials = (value) => {
  const tokens = normalizeOperationName(value)
    .split(' ')
    .map((token) => token.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
    .filter((token) => !INITIAL_CONNECTORS.has(token.toLocaleLowerCase('pt-BR')))
  if (!tokens.length) return 'OP'
  if (tokens.length === 1) return [...tokens[0]].slice(0, 2).join('').toLocaleUpperCase('pt-BR')
  return `${[...tokens[0]][0]}${[...tokens.at(-1)][0]}`.toLocaleUpperCase('pt-BR')
}

function MenuAction({ label, description, icon, onClick, disabled = false, className = '' }) {
  return <button type="button" className={`operation-menu-action ${className}`} aria-label={label} disabled={disabled} onClick={onClick}>
    <Icon name={icon} size={18} />
    <span className="operation-menu-action-copy"><span>{label}</span>{description && <small>{description}</small>}</span>
    <svg className="operation-menu-chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
  </button>
}

export default function OperationMenu({ businessName, businessHasLogo = false, businessLogoVersion = null, showLogo = true, user, onSwitchCompany, onPlatform, onSwitchUser, onLogout, logoutDisabled = false }) {
  const { granted, implemented, requestNavigation, authenticated } = useNavigation()
  const operationName = normalizeOperationName(businessName)
  const initials = operationInitials(operationName)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  const mobile = useMediaQuery('(max-width: 820px)')
  const [open, setOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const settingsEntry = resolveNavigationEntry({ area: 'settings', label: 'Configurações', icon: 'settings' }, granted, implemented)
  const companySettingsEntry = resolveNavigationEntry({ area: 'settings' }, new Set([...(granted || [])].filter(capability => capability !== 'preferences.local')), implemented)
  const deviceEntry = resolveNavigationEntry({ id: 'settings-device', label: 'Preferências deste dispositivo', icon: 'system' }, granted, implemented)
  const accountEntry = resolveNavigationEntry({ id: 'my-account' }, granted, implemented, { authenticated })
  const restoreFocus = useCallback(() => {
    if (typeof window !== 'undefined' && window.requestAnimationFrame) window.requestAnimationFrame(() => triggerRef.current?.focus?.())
    else triggerRef.current?.focus?.()
  }, [])
  const close = useCallback(() => { setOpen(false); restoreFocus() }, [restoreFocus])

  useEffect(() => {
    if (!open || mobile || typeof document === 'undefined') return undefined
    panelRef.current?.querySelector?.('button:not([disabled])')?.focus?.()
    const onKeyDown = (event) => { if (event.key === 'Escape') { event.preventDefault(); close() } }
    const onMouseDown = (event) => { if (!rootRef.current?.contains?.(event.target)) close() }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onMouseDown)
    return () => { document.removeEventListener('keydown', onKeyDown); document.removeEventListener('mousedown', onMouseDown) }
  }, [open, mobile, close])

  const navigate = (id) => { close(); requestNavigation(id) }
  const openAbout = () => {
    triggerRef.current?.focus?.()
    setOpen(false)
    setAboutOpen(true)
  }
  const personName = user?.displayName?.trim()
  const profileName = user?.roleName || (user?.roleId === 'manager' ? 'Gerente' : user?.roleId === 'operator' ? 'Operador' : 'Perfil não informado')
  const operationIdentity = (className) => showLogo
    ? <OperationLogo hasLogo={businessHasLogo} version={businessLogoVersion} className={className} fallback={<span className="operation-menu-initials" aria-hidden="true">{initials}</span>} />
    : <span className="operation-menu-initials" aria-hidden="true">{initials}</span>
  const content = <div className="operation-menu-content">
    {personName && <header className="operation-menu-person">
      <span className="operation-menu-avatar" aria-hidden="true">{[...personName][0].toLocaleUpperCase('pt-BR')}</span>
      <span className="operation-menu-person-copy"><strong>{personName}</strong><small>{profileName}</small></span>
      <span className="operation-menu-connected">Conectado</span>
    </header>}
    {(accountEntry || onSwitchUser) && <section className="operation-menu-section" aria-label="Sua conta">
      <h2>Sua conta</h2>
      {accountEntry && <MenuAction label="Minha conta" description="Seus dados e sua senha" icon="client" onClick={() => navigate(accountEntry.id)} />}
      {onSwitchUser && <MenuAction label="Trocar usuário" description="Encerrar a sessão e abrir o login" icon="clients" disabled={logoutDisabled} onClick={() => { close(); onSwitchUser() }} />}
    </section>}
    <section className="operation-menu-section operation-menu-company-section" aria-label="Empresa atual">
      <h2>Empresa</h2>
      <div className="operation-menu-heading">
        {operationIdentity('operation-menu-logo')}
        <div className="operation-menu-heading-copy"><strong>{operationName}</strong>
          <span>Empresa atual{personName && <> · {profileName}</>}</span>
        </div>
      </div>
      {onSwitchCompany && <MenuAction label="Trocar empresa" description="Escolher onde você vai trabalhar" icon="transfer" disabled={logoutDisabled} onClick={() => { close(); onSwitchCompany() }} />}
      {companySettingsEntry && <MenuAction label="Configurações da empresa" description={`Ajustes de ${operationName}`} icon="settings" onClick={() => navigate(companySettingsEntry.id)} />}
    </section>
    {onPlatform && <section className="operation-menu-section operation-menu-platform-section" aria-label="Administração Mesiva">
      <h2>Mesiva</h2>
      <MenuAction label="Administração Mesiva" icon="settings" disabled={logoutDisabled} onClick={() => { close(); onPlatform() }} />
    </section>}
    <section className="operation-menu-section" aria-label="Preferências e ajuda">
      <h2>Preferências e ajuda</h2>
      {!companySettingsEntry && settingsEntry && <MenuAction label="Configurações" icon="settings" onClick={() => navigate(settingsEntry.id)} />}
      {deviceEntry && <MenuAction label="Este dispositivo" description="Tema e som de novos pedidos" icon="system" onClick={() => navigate(deviceEntry.id)} />}
      <MenuAction label="Sobre a Mesiva" icon="details" onClick={openAbout} />
    </section>
    {onLogout && <footer className="operation-menu-footer"><MenuAction label="Sair do sistema" icon="logout" className="operation-menu-logout" disabled={logoutDisabled} onClick={() => { close(); onLogout() }} /></footer>}
  </div>
  return <div className="operation-menu" ref={rootRef}>
    <button ref={triggerRef} type="button" className="operation-menu-trigger" aria-label={`${operationName}, empresa atual`} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((current) => !current)}>
      {showLogo
        ? <OperationLogo
            hasLogo={businessHasLogo}
            version={businessLogoVersion}
            className="operation-menu-logo"
            fallback={<span className="operation-menu-initials" aria-hidden="true">{initials}</span>}
          />
        : <span className="operation-menu-initials" aria-hidden="true">{initials}</span>}
      <span className="operation-menu-trigger-copy"><strong>{operationName}</strong><small>Empresa atual</small></span>
      <Icon name="arrow-down" size={14} />
    </button>
    {open && (mobile
      ? <BottomSheet open title="Conta e empresa" onClose={close}>{content}</BottomSheet>
      : <div ref={panelRef} className="operation-menu-popover" role="dialog" aria-label="Conta e empresa" onBlur={(event) => { if (event.relatedTarget && !rootRef.current?.contains?.(event.relatedTarget)) setOpen(false) }}>{content}</div>)}
    {aboutOpen && <Modal title="Sobre a Mesiva" onClose={() => { setAboutOpen(false); restoreFocus() }}>
      <div className="operation-about-copy">
        <strong>Mesiva</strong>
        <span>Empresa atual: {operationName}</span>
        <span>Atualização atual: {CURRENT_RELEASE.title}</span>
        <span>{formatReleaseDate(CURRENT_RELEASE.publishedAt)}</span>
      </div>
    </Modal>}
  </div>
}
