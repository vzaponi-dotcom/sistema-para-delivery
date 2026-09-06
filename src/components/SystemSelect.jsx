import { useEffect, useId, useRef, useState } from 'react'
import '../system-select.css'
import BottomSheet from './BottomSheet'
import Icon from './Icon'

const mobileQuery = '(max-width: 820px)'

function SystemSelect({ value, options, onChange, disabled = false, label, id, placeholder = 'Selecione' }) {
  const generatedId = useId()
  const selectId = id || generatedId
  const listboxId = `${selectId}-options`
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, options.findIndex((option) => option.value === value)))
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(mobileQuery).matches)
  const selected = options.find((option) => option.value === value)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const media = window.matchMedia(mobileQuery)
    const update = () => setMobile(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!open || mobile) return undefined
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [mobile, open])

  const close = () => {
    setOpen(false)
    window.requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const choose = (option) => {
    onChange(option.value)
    close()
  }

  const openSelect = () => {
    if (disabled || !options.length) return
    const selectedIndex = options.findIndex((option) => option.value === value)
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
    setOpen(true)
  }

  const handleKeyDown = (event) => {
    if (disabled || mobile) return

    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault()
        close()
      }
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        openSelect()
        return
      }
      const direction = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((current) => (current + direction + options.length) % options.length)
      return
    }

    if ((event.key === 'Enter' || event.key === ' ') && open) {
      event.preventDefault()
      const option = options[activeIndex]
      if (option) choose(option)
    }
  }

  const optionButtons = (className) => options.map((option, index) => (
    <button
      key={option.value}
      type="button"
      className={`${className}${index === activeIndex ? ' active' : ''}`}
      role="option"
      aria-selected={option.value === value}
      onMouseEnter={() => setActiveIndex(index)}
      onClick={() => choose(option)}
    >
      <span>{option.label}</span>
      {option.value === value && <Icon name="check" size={17} />}
    </button>
  ))

  return (
    <div className="system-select" ref={rootRef}>
      <button
        id={selectId}
        ref={triggerRef}
        type="button"
        className="system-select-trigger"
        role="combobox"
        aria-label={label}
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => open ? close() : openSelect()}
        onKeyDown={handleKeyDown}
      >
        <span>{selected?.label || placeholder}</span>
        <Icon name="arrow-down" size={16} />
      </button>

      {open && (mobile ? (
        <BottomSheet open title={label} onClose={close}>
          <div id={listboxId} className="system-select-sheet-options" role="listbox" aria-label={label}>
            {optionButtons('system-select-sheet-option')}
          </div>
        </BottomSheet>
      ) : (
        <div id={listboxId} className="system-select-dropdown" role="listbox" aria-label={label}>
          {optionButtons('system-select-option')}
        </div>
      ))}
    </div>
  )
}

export default SystemSelect
