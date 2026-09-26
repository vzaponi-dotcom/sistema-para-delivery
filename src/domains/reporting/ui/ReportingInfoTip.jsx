import { useId, useState } from 'react'
import Icon from '../../../shared/ui/Icon.jsx'
import { reportingHelpFor } from './reportingHelp.js'
const WIDTH = 320
const HEIGHT = 205
const GAP = 10
export function ReportingInfoTip({ helpKey, focusable = true }) {
  const help = reportingHelpFor(helpKey)
  const id = useId()
  const [position, setPosition] = useState(null)
  if (!help) return null
  const fallback = `${help.description} Como é calculado: ${help.calculation} Como interpretar: ${help.interpretation}`
  const show = (event) => {
    const rect = event.currentTarget?.getBoundingClientRect?.()
    if (!rect || typeof window === 'undefined') return
    const half = WIDTH / 2
    const left = Math.min(Math.max(rect.left + rect.width / 2, half + 12), Math.max(half + 12, window.innerWidth - half - 12))
    const above = rect.bottom + GAP + HEIGHT > window.innerHeight && rect.top > HEIGHT + GAP
    setPosition({ left, top: above ? rect.top - GAP : rect.bottom + GAP, above })
  }
  return <span className="reporting-info-tip" tabIndex={focusable ? 0 : undefined} aria-label={`Informações sobre ${helpKey}`} aria-describedby={position ? id : undefined} title={fallback} onMouseEnter={show} onMouseLeave={() => setPosition(null)} onFocus={show} onBlur={() => setPosition(null)} onClick={(event) => event.stopPropagation()}>
    <span className="reporting-info-trigger" aria-hidden="true"><Icon name="details" size={13} /></span>
    {position ? <span id={id} role="tooltip" className={`reporting-info-popover ${position.above ? 'is-above' : ''}`} style={{ left: position.left, top: position.top }}>
      <strong>{helpKey}</strong>
      <span><b>O que é</b>{help.description}</span>
      <span><b>Como é calculado</b>{help.calculation}</span>
      <span><b>Como interpretar</b>{help.interpretation}</span>
    </span> : null}
  </span>
}
