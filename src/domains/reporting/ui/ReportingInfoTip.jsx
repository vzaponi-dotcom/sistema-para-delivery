import { useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { reportingHelpFor } from './reportingHelp.js'

const WIDTH = 320
const HEIGHT = 220
const GAP = 10

export function ReportingInfoTip({ helpKey, focusable = true }) {
  const help = reportingHelpFor(helpKey)
  const id = useId()
  const [position, setPosition] = useState(null)
  if (!help) return null

  const show = (event) => {
    const rect = event.currentTarget?.getBoundingClientRect?.()
    if (!rect || typeof window === 'undefined') return
    const viewportWidth = Number(window.innerWidth) || 1440
    const viewportHeight = Number(window.innerHeight) || 900
    const half = WIDTH / 2
    const left = Math.min(Math.max(rect.left + rect.width / 2, half + 12), Math.max(half + 12, viewportWidth - half - 12))
    const above = rect.bottom + GAP + HEIGHT > viewportHeight && rect.top > HEIGHT + GAP
    setPosition({ left, top: above ? rect.top - GAP : rect.bottom + GAP, above })
  }
  const hide = () => setPosition(null)

  const popover = position ? <span
    id={id}
    role="tooltip"
    className={`reporting-info-popover ${position.above ? 'is-above' : ''}`}
    style={{ left: position.left, top: position.top }}
  >
    <strong>{helpKey}</strong>
    <span><b>O que é</b>{help.description}</span>
    <span><b>Como é calculado</b>{help.calculation}</span>
    <span><b>Como interpretar</b>{help.interpretation}</span>
  </span> : null

  return <span
    className="reporting-info-tip"
    tabIndex={focusable ? 0 : undefined}
    aria-label={`Informações sobre ${helpKey}`}
    aria-describedby={position ? id : undefined}
    onMouseEnter={show}
    onMouseLeave={hide}
    onFocus={show}
    onBlur={hide}
    onClick={(event) => event.stopPropagation()}
    onMouseDown={(event) => event.stopPropagation()}
  >
    <span className="reporting-info-trigger" aria-hidden="true">i</span>
    {popover && typeof document !== 'undefined' && document.body ? createPortal(popover, document.body) : popover}
  </span>
}
