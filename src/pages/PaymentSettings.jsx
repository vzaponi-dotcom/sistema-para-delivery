import { useMemo, useState } from 'react'
import SettingsEditorShell from '../components/SettingsEditorShell.jsx'
import { paymentLabel } from '../../shared/businessPolicies.js'
import '../payment-settings.css'

const blockedStatuses = new Set(['loading', 'saving', 'unconfirmed', 'conflict'])
const descriptions = { pix: 'Pagamento instantâneo', cash: 'Pagamento na entrega', debit_card: 'Visa, Mastercard, Elo e outros', credit_card: 'Visa, Mastercard, Elo e outros', transfer: 'TED, DOC ou transferência bancária', other: 'Outros métodos de pagamento' }
const normalizedMethods = (data) => [...(data?.methods || [])].sort((left, right) => left.sortOrder - right.sortOrder).map((method, sortOrder) => ({ ...method, sortOrder }))
const reorder = (methods, sourceIndex, targetIndex) => {
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex >= methods.length || targetIndex >= methods.length) return methods
  const next = [...methods]
  const [method] = next.splice(sourceIndex, 1)
  next.splice(targetIndex, 0, method)
  return next
}

function PaymentIcon({ code }) {
  if (code === 'pix') return <svg data-payment-icon="pix" className="payment-icon payment-icon-pix" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.15 3.7a2.1 2.1 0 0 0-2.97 0L3.7 5.18a2.1 2.1 0 0 0 0 2.97l2.99 2.99a1.9 1.9 0 0 0 2.68 0l1.29-1.29a1.9 1.9 0 0 1 2.68 0l1.29 1.29a1.9 1.9 0 0 0 2.68 0l2.99-2.99a2.1 2.1 0 0 0 0-2.97L18.82 3.7a2.1 2.1 0 0 0-2.97 0l-1.58 1.58a1.9 1.9 0 0 1-2.54 0L10.15 3.7ZM6.69 12.86 3.7 15.85a2.1 2.1 0 0 0 0 2.97l1.48 1.48a2.1 2.1 0 0 0 2.97 0l2.99-2.99a1.9 1.9 0 0 1 2.68 0l2.99 2.99a2.1 2.1 0 0 0 2.97 0l1.48-1.48a2.1 2.1 0 0 0 0-2.97l-2.99-2.99a1.9 1.9 0 0 0-2.68 0l-1.29 1.29a1.9 1.9 0 0 1-2.68 0l-1.29-1.29a1.9 1.9 0 0 0-2.68 0Z" /></svg>
  if (code === 'cash') return <svg data-payment-icon="cash" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6.5 9.5h.01M17.5 14.5h.01"/></svg>
  if (code === 'debit_card' || code === 'credit_card') return <svg data-payment-icon="card" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></svg>
  if (code === 'transfer') return <svg data-payment-icon="transfer" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10 12 4l9 6M5 10v9h14v-9M3 20h18M8 13v3M12 13v3M16 13v3"/></svg>
  return <svg data-payment-icon="other" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle className="payment-icon-dot" cx="8" cy="12" r=".8"/><circle className="payment-icon-dot" cx="12" cy="12" r=".8"/><circle className="payment-icon-dot" cx="16" cy="12" r=".8"/></svg>
}

function PaymentSettings({ resourceState, readOnly = false, onEdit, onSave, onDiscard, onReconcile, onReload, onReviewConflict, onNavigateHome }) {
  const data = resourceState?.draft || resourceState?.confirmed?.data || null
  const methods = normalizedMethods(data)
  const activeCount = methods.filter((method) => method.active).length
  const locked = readOnly || !data || blockedStatuses.has(resourceState?.status)
  const lockedReason = locked ? 'A configuração está temporariamente bloqueada.' : ''
  const [drag, setDrag] = useState(null)
  const previewMethods = useMemo(() => drag ? reorder(methods, drag.sourceIndex, drag.targetIndex) : methods, [drag, methods])
  const editMethods = (nextMethods, patch = {}) => {
    if (locked) return false
    onEdit?.({ ...data, ...patch, methods: nextMethods.map((method, sortOrder) => ({ ...method, sortOrder })) })
    return true
  }
  const move = (code, direction) => {
    const sourceIndex = methods.findIndex((method) => method.code === code)
    const targetIndex = sourceIndex + direction
    return sourceIndex < 0 || targetIndex < 0 || targetIndex >= methods.length ? false : editMethods(reorder(methods, sourceIndex, targetIndex))
  }
  const action = (method, actionId) => {
    if (locked) return false
    if (actionId === 'up') return move(method.code, -1)
    if (actionId === 'down') return move(method.code, 1)
    if (actionId === 'default') return method.active ? editMethods(methods, { defaultMethod: method.code }) : false
    if (actionId === 'activate') return editMethods(methods.map((candidate) => candidate.code === method.code ? { ...candidate, active: true } : candidate))
    if (actionId === 'deactivate' && method.active && method.code !== data.defaultMethod && activeCount > 1) return editMethods(methods.map((candidate) => candidate.code === method.code ? { ...candidate, active: false } : candidate))
    return false
  }
  const targetIndexAt = (event, sourceIndex) => {
    const target = document.elementFromPoint?.(event.clientX, event.clientY)?.closest?.('[data-payment-code]')
    const rowIndex = methods.findIndex((method) => method.code === target?.dataset?.paymentCode)
    if (rowIndex < 0) return drag?.targetIndex ?? sourceIndex
    const rect = target.getBoundingClientRect?.()
    let targetIndex = rowIndex + (!rect || event.clientY >= rect.top + rect.height / 2 ? 1 : 0)
    if (targetIndex > sourceIndex) targetIndex -= 1
    return Math.max(0, Math.min(methods.length - 1, targetIndex))
  }
  const startPointerDrag = (event, code) => {
    if (locked) return
    event.preventDefault()
    const sourceIndex = methods.findIndex((method) => method.code === code)
    if (sourceIndex < 0) return
    const rect = event.currentTarget.closest?.('[data-payment-code]')?.getBoundingClientRect?.()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDrag({ code, pointerId: event.pointerId, sourceIndex, targetIndex: sourceIndex, x: event.clientX, y: event.clientY, offsetY: rect ? event.clientY - rect.top : 0 })
  }
  const movePointerDrag = (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    setDrag((current) => current && current.pointerId === event.pointerId ? { ...current, targetIndex: targetIndexAt(event, current.sourceIndex), x: event.clientX, y: event.clientY } : current)
  }
  const finishPointerDrag = (event, commit) => {
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault?.()
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    const targetIndex = targetIndexAt(event, drag.sourceIndex)
    if (commit) editMethods(reorder(methods, drag.sourceIndex, targetIndex))
    setDrag(null)
  }
  const renderRow = (method, index) => {
    const isDefault = method.code === data.defaultMethod
    const isPlaceholder = drag?.code === method.code
    const disabledReason = method.active && (isDefault || activeCount <= 1) ? (isDefault ? 'Defina outro método ativo como padrão antes de desativar este.' : 'Mantenha pelo menos uma forma de pagamento ativa.') : ''
    return <article role="row" data-payment-code={method.code} className={['payment-settings-row', isPlaceholder ? 'is-drag-placeholder' : ''].filter(Boolean).join(' ')} aria-hidden={isPlaceholder || undefined} onKeyDown={locked ? undefined : (event) => { if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return; event.preventDefault(); move(method.code, event.key === 'ArrowUp' ? -1 : 1) }}>
      <div className="payment-order-cell" role="cell"><button type="button" className="payment-drag-handle" data-payment-drag-handle={method.code} aria-label={`Reordenar ${paymentLabel(method.code)}`} disabled={locked} onPointerDown={(event) => startPointerDrag(event, method.code)} onPointerMove={movePointerDrag} onPointerUp={(event) => finishPointerDrag(event, true)} onPointerCancel={(event) => finishPointerDrag(event, false)}><span aria-hidden="true">⠿</span></button><span>{index + 1}</span></div>
      <div className="payment-method-cell" role="cell"><span className="payment-method-icon"><PaymentIcon code={method.code} /></span><span><strong>{paymentLabel(method.code)}</strong><small>{descriptions[method.code]}</small></span></div>
      <div className="payment-meta-cell" role="cell"><span className={method.active ? 'payment-status-badge is-active' : 'payment-status-badge'}><i aria-hidden="true" />{method.active ? 'Ativo' : 'Inativo'}</span>{isDefault ? <span className="payment-default-badge">★ <span>Padrão</span></span> : <span className="payment-default-dash">—</span>}</div>
      <div className="payment-actions-cell" role="cell" data-payment-actions={method.code}>{!readOnly && <details className="payment-actions-menu" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false }}><summary aria-label={`Ações de ${paymentLabel(method.code)}`}>···</summary><div><button type="button" disabled={Boolean(lockedReason || disabledReason)} title={lockedReason || disabledReason} onClick={() => action(method, method.active ? 'deactivate' : 'activate')}>{method.active ? 'Desativar' : 'Ativar'}</button>{method.active && !isDefault && <button type="button" disabled={Boolean(lockedReason)} onClick={() => action(method, 'default')}>Definir como padrão</button>}<button type="button" disabled={Boolean(lockedReason) || index === 0} onClick={() => action(method, 'up')}>Mover para cima</button><button type="button" disabled={Boolean(lockedReason) || index === methods.length - 1} onClick={() => action(method, 'down')}>Mover para baixo</button></div></details>}</div>
    </article>
  }
  return <SettingsEditorShell className="payment-editor" title="Formas de pagamento" description="Gerencie os métodos de pagamento aceitos no seu delivery" scope={<button type="button" className="payment-breadcrumb" onClick={onNavigateHome}>Configurações</button>} discardLabel="Cancelar" footerNote="Gestão Delivery · v1.0.0" effectiveNotice={<><span className="payment-info-icon" aria-hidden="true">i</span><span>Os métodos nativos não podem ser renomeados.<small className="payment-notice-secondary">As alterações realizadas serão aplicadas após salvar.</small></span></>} state={resourceState} readOnly={readOnly} onSave={onSave} onDiscard={onDiscard} onReconcile={onReconcile} onReload={onReload} onReviewConflict={onReviewConflict}>
    {!data ? <p className="settings-empty-state">Os métodos confirmados aparecerão quando esta configuração estiver disponível.</p> : <section className="payment-settings-table" role="table" aria-label="Formas de pagamento"><div className="payment-settings-table-head" role="row"><span>ORDEM</span><span>FORMA</span><span>STATUS</span><span>PADRÃO</span><span>AÇÕES</span></div><div className="payment-settings-table-body" role="rowgroup">{previewMethods.map((method, index) => <div className="payment-row-slot" key={method.code}>{drag?.code === method.code && <div className="payment-insertion-marker" data-payment-insertion-marker={String(index)} aria-hidden="true" />}{renderRow(method, index)}</div>)}</div></section>}
    {drag && <div className="payment-drag-overlay" data-payment-drag-overlay={drag.code} aria-hidden="true" style={{ transform: `translate3d(${drag.x + 12}px, ${drag.y - drag.offsetY}px, 0)` }}><span className="payment-method-icon"><PaymentIcon code={drag.code} /></span><span><strong>{paymentLabel(drag.code)}</strong><small>{descriptions[drag.code]}</small></span></div>}
  </SettingsEditorShell>
}

export default PaymentSettings
