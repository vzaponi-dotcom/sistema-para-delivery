import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import '../../../../settings-controls.css'

const renderBackButton = ({ onClick, className, buttonRef }) => <button
  ref={buttonRef}
  type="button"
  className={['settings-back-link', className].filter(Boolean).join(' ')}
  onClick={onClick}
  aria-label="Voltar para Configurações"
>
  <span aria-hidden="true">←</span>
  <span>Configurações</span>
</button>

export function SettingsBackLink({ onClick, className = '' }) {
  const inlineRef = useRef(null)
  const [showFloating, setShowFloating] = useState(false)

  useEffect(() => {
    const target = inlineRef.current
    if (!target || typeof IntersectionObserver === 'undefined') return undefined

    const observer = new IntersectionObserver(([entry]) => {
      const leftThroughTop = !entry.isIntersecting && entry.boundingClientRect.top < 0
      setShowFloating(leftThroughTop)
    }, { threshold: 0 })

    observer.observe(target)
    return () => observer.disconnect()
  }, [])

  const inlineControl = renderBackButton({
    onClick,
    className: ['settings-back-link--inline', className].filter(Boolean).join(' '),
    buttonRef: inlineRef,
  })

  if (!showFloating || typeof document === 'undefined') return inlineControl

  const floatingControl = renderBackButton({
    onClick,
    className: ['settings-back-link--floating', className].filter(Boolean).join(' '),
  })

  return <>
    {inlineControl}
    {createPortal(floatingControl, document.body)}
  </>
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
