import { createPortal } from 'react-dom'
import '../settings-controls.css'

export function SettingsBackLink({ onClick, className = '' }) {
  const control = <button
    type="button"
    className={['settings-back-link', className].filter(Boolean).join(' ')}
    onClick={onClick}
    aria-label="Voltar para Configurações"
  >
    <span aria-hidden="true">←</span>
    <span>Configurações</span>
  </button>

  if (typeof document === 'undefined') return control
  return createPortal(control, document.body)
}

export function SettingsSwitch({
  id,
  checked,
  disabled = false,
  onChange,
  label,
  describedBy,
  title,
  className = '',
}) {
  return <button
    type="button"
    role="switch"
    aria-checked={Boolean(checked)}
    aria-label={label}
    aria-describedby={describedBy || undefined}
    title={title || undefined}
    disabled={disabled}
    data-settings-switch={id}
    className={['settings-switch', className].filter(Boolean).join(' ')}
    onClick={() => onChange?.(!checked)}
  ><span aria-hidden="true" /></button>
}
