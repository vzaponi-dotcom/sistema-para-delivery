import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import '../bottom-sheet.css'
import Icon from './Icon'

const focusable = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
const dialogSelector = '[role="dialog"][aria-modal="true"]'
const isTopmostDialog = (element) => {
  const dialogs = Array.from(document.querySelectorAll(dialogSelector))
  return dialogs.at(-1) === element
}

function BottomSheet({ open, title, onClose, children }) {
  const sheetRef = useRef(null)
  const previousFocus = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    previousFocus.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const controls = () => Array.from(sheetRef.current?.querySelectorAll(focusable) || [])
    controls()[0]?.focus()

    const handleKeyDown = (event) => {
      if (!isTopmostDialog(sheetRef.current)) return

      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const items = controls()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocus.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  const content = (
    <div className="bottom-sheet-backdrop" data-navigation-swipe-block="true" onMouseDown={onClose}>
      <section
        ref={sheetRef}
        className="bottom-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-navigation-swipe-block="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="bottom-sheet-header">
          <strong>{title}</strong>
          <button type="button" className="icon-button icon-button-neutral" aria-label="Fechar" onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="bottom-sheet-body">{children}</div>
      </section>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content
}

export default BottomSheet
