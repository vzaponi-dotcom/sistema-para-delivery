import { useState } from 'react'
import Button from '../components/Button.jsx'
import Icon from '../components/Icon.jsx'
import SettingsEditorShell from '../components/SettingsEditorShell.jsx'
import { paymentLabel } from '../../shared/businessPolicies.js'
import '../payment-settings.css'

const blockedStatuses = new Set(['loading', 'saving', 'unconfirmed', 'conflict'])
const descriptions = { pix: 'Pagamento instantâneo', cash: 'Pagamento na entrega', debit_card: 'Visa, Mastercard, Elo e outros', credit_card: 'Visa, Mastercard, Elo e outros', transfer: 'TED, DOC ou transferência bancária', other: 'Outros métodos de pagamento' }

function PaymentIcon({ code }) {
  if (code === 'pix') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 4 4-3 4 3 4 4-4 4-4 3-4-3-4-4 4-4Z"/><path d="m9 9 3 3 3-3M9 15l3-3 3 3"/></svg>
  if (code === 'cash') return <Icon name="finance" size={25} />
  if (code === 'transfer') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10 12 4l9 6M5 10v9h14v-9M3 20h18M8 13v3M12 13v3M16 13v3"/></svg>
  if (code === 'other') return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="8" cy="12" r=".7" fill="currentColor"/><circle cx="12" cy="12" r=".7" fill="currentColor"/><circle cx="16" cy="12" r=".7" fill="currentColor"/></svg>
  return <Icon name="wallet" size={25} />
}

const normalizedMethods = (data) => [...(data?.methods || [])].sort((left, right) => left.sortOrder - right.sortOrder).map((method, sortOrder) => ({ ...method, sortOrder }))

function PaymentSettings({ resourceState, readOnly = false, onEdit, onSave, onDiscard, onReconcile, onReload, onReviewConflict, onNavigateHome }) {
  const data = resourceState?.draft || resourceState?.confirmed?.data || null
  const methods = normalizedMethods(data)
  const activeCount = methods.filter((method) => method.active).length
  const locked = readOnly || !data || blockedStatuses.has(resourceState?.status)
  const [dragCode, setDragCode] = useState(null)
  const lockedReason = locked ? 'A configuração está temporariamente bloqueada.' : ''
  const editMethods = (nextMethods, patch = {}) => {
    if (locked) return false
    onEdit?.({ ...data, ...patch, methods: nextMethods.map((method, sortOrder) => ({ ...method, sortOrder })) })
    return true
  }
  const move = (code, direction) => {
    const index = methods.findIndex((method) => method.code === code)
    const target = index + direction
    if (index < 0 || target < 0 || target >= methods.length) return false
    const next = [...methods]
    ;[next[index], next[target]] = [next[target], next[index]]
    return editMethods(next)
  }
  const moveTo = (source, target) => {
    if (!source || source === target || locked) return false
    const sourceIndex = methods.findIndex((method) => method.code === source)
    const targetIndex = methods.findIndex((method) => method.code === target)
    if (sourceIndex < 0 || targetIndex < 0) return false
    const next = [...methods]
    const [method] = next.splice(sourceIndex, 1)
    next.splice(targetIndex, 0, method)
    return editMethods(next)
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
  const startPointerDrag = (event, code) => {
    if (locked) return
    event.preventDefault()
    setDragCode(code)
    const findTarget = (pointerEvent) => document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY)?.closest?.('[data-payment-code]')?.dataset?.paymentCode
    const movePointer = (pointerEvent) => pointerEvent.preventDefault()
    const endPointer = (pointerEvent) => {
      document.removeEventListener('pointermove', movePointer)
      document.removeEventListener('pointerup', endPointer)
      moveTo(code, findTarget(pointerEvent))
      setDragCode(null)
    }
    document.addEventListener('pointermove', movePointer, { passive: false })
    document.addEventListener('pointerup', endPointer)
  }
  return <SettingsEditorShell className="payment-editor" title="Formas de pagamento" description="Gerencie os métodos de pagamento aceitos no seu delivery" scope={<button type="button" className="payment-breadcrumb" onClick={onNavigateHome}>Configurações</button>} discardLabel="Cancelar" footerNote="Gestão Delivery · v1.0.0" effectiveNotice={<><span className="payment-info-icon" aria-hidden="true">i</span><span>Os métodos nativos não podem ser renomeados.<small>As alterações realizadas serão aplicadas após salvar.</small></span></>} state={resourceState} readOnly={readOnly} onSave={onSave} onDiscard={onDiscard} onReconcile={onReconcile} onReload={onReload} onReviewConflict={onReviewConflict}>
    <div className="payment-editor-toolbar"><Button type="button" icon="plus" disabled title="O catálogo de formas de pagamento é nativo nesta versão.">Adicionar forma</Button></div>
    {!data ? <p className="settings-empty-state">Os métodos confirmados aparecerão quando esta configuração estiver disponível.</p> : <section className="payment-settings-table" role="table" aria-label="Formas de pagamento">
      <div className="payment-settings-table-head" role="row"><span>ORDEM</span><span>FORMA</span><span>STATUS</span><span>PADRÃO</span><span>AÇÕES</span></div>
      <div className="payment-settings-table-body" role="rowgroup">{methods.map((method, index) => {
        const isDefault = method.code === data.defaultMethod
        const disabledReason = method.active && (isDefault || activeCount <= 1) ? (isDefault ? 'Defina outro método ativo como padrão antes de desativar este.' : 'Mantenha pelo menos uma forma de pagamento ativa.') : ''
        return <article key={method.code} role="row" data-payment-code={method.code} className={['payment-settings-row', dragCode === method.code ? 'is-dragging' : ''].filter(Boolean).join(' ')} onKeyDown={locked ? undefined : (event) => { if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return; event.preventDefault(); move(method.code, event.key === 'ArrowUp' ? -1 : 1) }} onDragOver={(event) => { if (dragCode && !locked) event.preventDefault() }} onDrop={(event) => { event.preventDefault(); moveTo(dragCode, method.code); setDragCode(null) }}>
          <div className="payment-order-cell" role="cell"><button type="button" className="payment-drag-handle" data-payment-drag-handle={method.code} aria-label={`Reordenar ${paymentLabel(method.code)}`} draggable={!locked} disabled={locked} onPointerDown={(event) => startPointerDrag(event, method.code)} onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; setDragCode(method.code) }} onDragEnd={() => setDragCode(null)}><span aria-hidden="true">⠿</span></button><span>{index + 1}</span></div>
          <div className="payment-method-cell" role="cell"><span className="payment-method-icon"><PaymentIcon code={method.code} /></span><span><strong>{paymentLabel(method.code)}</strong><small>{descriptions[method.code]}</small></span></div>
          <div className="payment-status-cell" role="cell"><span className={method.active ? 'payment-status-badge is-active' : 'payment-status-badge'}><i aria-hidden="true" />{method.active ? 'Ativo' : 'Inativo'}</span></div>
          <div className="payment-default-cell" role="cell">{isDefault ? <span className="payment-default-badge">★ <span>Padrão</span></span> : <span className="payment-default-dash">—</span>}</div>
          <div className="payment-actions-cell" role="cell" data-payment-actions={method.code}>{!readOnly && <details className="payment-actions-menu" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false }}><summary aria-label={`Ações de ${paymentLabel(method.code)}`}>···</summary><div><button type="button" disabled={Boolean(lockedReason || disabledReason)} title={lockedReason || disabledReason} onClick={() => action(method, method.active ? 'deactivate' : 'activate')}>{method.active ? 'Desativar' : 'Ativar'}</button>{method.active && !isDefault && <button type="button" disabled={Boolean(lockedReason)} onClick={() => action(method, 'default')}>Definir como padrão</button>}<button type="button" disabled={Boolean(lockedReason) || index === 0} onClick={() => action(method, 'up')}>Mover para cima</button><button type="button" disabled={Boolean(lockedReason) || index === methods.length - 1} onClick={() => action(method, 'down')}>Mover para baixo</button></div></details>}</div>
        </article>
      })}</div>
    </section>}
  </SettingsEditorShell>
}

export default PaymentSettings
