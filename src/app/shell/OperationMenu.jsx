import { useEffect, useRef, useState } from 'react'
import Icon from '../../shared/ui/Icon'
import Modal from '../../shared/ui/Modal'
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

export default function OperationMenu({ businessName, businessHasLogo = false, businessLogoVersion = null, showLogo = true, onLogout, logoutDisabled = false }) {
  const { granted, implemented, requestNavigation } = useNavigation()
  const operationName = normalizeOperationName(businessName)
  const initials = operationInitials(operationName)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const settingsEntry = resolveNavigationEntry({ area: 'settings', label: 'Configurações', icon: 'settings' }, granted, implemented)
  const deviceEntry = resolveNavigationEntry({ id: 'settings-device', label: 'Preferências deste dispositivo', icon: 'system' }, granted, implemented)
  const restoreFocus = () => {
    if (typeof window !== 'undefined' && window.requestAnimationFrame) window.requestAnimationFrame(() => triggerRef.current?.focus?.())
    else triggerRef.current?.focus?.()
  }
  const close = () => { setOpen(false); restoreFocus() }

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined
    const onKeyDown = (event) => { if (event.key === 'Escape') { event.preventDefault(); close() } }
    const onMouseDown = (event) => { if (!rootRef.current?.contains?.(event.target)) close() }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onMouseDown)
    return () => { document.removeEventListener('keydown', onKeyDown); document.removeEventListener('mousedown', onMouseDown) }
  }, [open])

  const navigate = (id) => { close(); requestNavigation(id) }
  return <div className="operation-menu" ref={rootRef}>
    <button ref={triggerRef} type="button" className="operation-menu-trigger" aria-label={`${operationName}, operação atual`} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((current) => !current)}>
      {showLogo
        ? <OperationLogo
            hasLogo={businessHasLogo}
            version={businessLogoVersion}
            className="operation-menu-logo"
            fallback={<span className="operation-menu-initials" aria-hidden="true">{initials}</span>}
          />
        : <span className="operation-menu-initials" aria-hidden="true">{initials}</span>}
      <Icon name="arrow-down" size={14} />
    </button>
    {open && <div className="operation-menu-popover" role="menu" aria-label="Operação atual">
      <div className="operation-menu-heading"><strong>{operationName}</strong><span>Operação atual</span></div>
      {settingsEntry && <button type="button" role="menuitem" onClick={() => navigate(settingsEntry.id)}><Icon name="settings" size={18} />Configurações</button>}
      {deviceEntry && <button type="button" role="menuitem" onClick={() => navigate(deviceEntry.id)}><Icon name="system" size={18} />Preferências deste dispositivo</button>}
      <button type="button" role="menuitem" onClick={() => { setOpen(false); setAboutOpen(true) }}><Icon name="details" size={18} />Sobre a Mesiva</button>
      {onLogout && <><hr /><button type="button" role="menuitem" className="operation-menu-logout" disabled={logoutDisabled} onClick={() => { close(); onLogout() }}><Icon name="logout" size={18} />Sair do sistema</button></>}
    </div>}
    {aboutOpen && <Modal title="Sobre a Mesiva" onClose={() => { setAboutOpen(false); restoreFocus() }}>
      <div className="operation-about-copy">
        <strong>Mesiva</strong>
        <span>Operação atual: {operationName}</span>
        <span>Atualização atual: {CURRENT_RELEASE.title}</span>
        <span>{formatReleaseDate(CURRENT_RELEASE.publishedAt)}</span>
      </div>
    </Modal>}
  </div>
}
