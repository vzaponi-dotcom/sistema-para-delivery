import { useMemo, useRef, useState } from 'react'
import { resolveSettingsConflict } from '../app/settingsConflict.js'
import Button from './Button'
import Modal from './Modal'

const readable = (value, exists = true) => {
  if (!exists) return 'Item removido'
  if (value === null) return 'Nenhum'
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'Ativo' : 'Inativo'
  if (Array.isArray(value)) return value.map((item) => item?.label || item?.id || String(item)).join(' \u2192 ')
  return JSON.stringify(value)
}

const operationFields = {
  'timing.scheduledPrepLeadMinutes': { label: 'Preparo antecipado do agendado', unit: 'min' },
  'timing.scheduledLateGraceMinutes': { label: 'Toler\u00e2ncia de atraso do agendado', unit: 'min' },
  'timing.immediateLateAfterMinutes': { label: 'Pedido imediato fica atrasado', unit: 'min' },
  'timing.immediateVeryLateAfterMinutes': { label: 'Pedido imediato fica muito atrasado', unit: 'min' },
  enabledModalities: { label: 'Modalidades ativas', list: true },
  defaultModality: { label: 'Modalidade padr\u00e3o' },
}

const operationConflictKey = (conflict) => conflict.segments.map((segment) => (
  typeof segment === 'object' ? `[${segment.id}]` : segment
)).join('.')

const operationValue = (value, exists, field) => {
  if (!exists) return 'Nenhum'
  if (field?.list) return Array.isArray(value) && value.length ? value.join(', ') : 'Nenhuma'
  if (field?.unit && (typeof value === 'number' || typeof value === 'string')) return `${value} ${field.unit}`
  if (value === null || value === undefined || value === '') return 'Nenhum'
  if (typeof value === 'boolean') return value ? 'Ativo' : 'Inativo'
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return 'Configura\u00e7\u00e3o atualizada'
}

function OperationConflictItem({ conflict, choice, onChoice }) {
  const key = operationConflictKey(conflict)
  const field = operationFields[key] || { label: 'Configura\u00e7\u00e3o operacional' }
  return <fieldset className="settings-conflict-item operation-conflict-item" data-operation-conflict={key}>
    <legend>{field.label}</legend>
    <div className="settings-conflict-choices">
      {conflict.choices.includes('current') && conflict.choices.length > 1 && <label className="settings-conflict-choice">
        <input type="radio" name={conflict.id} aria-label={`Usar valor atual para ${field.label}`} checked={choice === 'current'} onChange={() => onChoice('current')} />
        <span><small>{'Atual no neg\u00f3cio'}</small><strong className="settings-conflict-value">{operationValue(conflict.current, conflict.currentExists, field)}</strong></span>
      </label>}
      {conflict.choices.includes('draft') && <label className="settings-conflict-choice">
        <input type="radio" name={conflict.id} aria-label={`Usar seu ajuste para ${field.label}`} checked={choice === 'draft'} onChange={() => onChoice('draft')} />
        <span><small>Seu ajuste</small><strong className="settings-conflict-value">{operationValue(conflict.draft, conflict.draftExists, field)}</strong></span>
      </label>}
    </div>
  </fieldset>
}

function SettingsConflictReview({ review, onAccept, onClose, disabled = false }) {
  const initialChoices = useMemo(() => Object.fromEntries(
    (review?.conflicts || []).filter(({ choices }) => choices.length === 1).map((conflict) => [conflict.id, conflict.choices[0]]),
  ), [review])
  const [choices, setChoices] = useState(initialChoices)
  const [accepting, setAccepting] = useState(false)
  const acceptingRef = useRef(false)

  if (!review) return null
  const operationReview = review.resource === 'operations'
  const unresolved = review.conflicts.some((conflict) => conflict.choices.length > 1 && !choices[conflict.id])
  const close = () => { if (!acceptingRef.current) onClose?.() }
  const accept = async () => {
    if (disabled || unresolved || acceptingRef.current) return false
    acceptingRef.current = true
    setAccepting(true)
    try {
      const candidate = resolveSettingsConflict(review, choices)
      await onAccept?.(candidate)
      return true
    } finally {
      acceptingRef.current = false
      setAccepting(false)
    }
  }

  return <Modal
    title={'Revisar altera\u00e7\u00f5es'}
    onClose={close}
    className={operationReview ? 'settings-conflict-modal' : ''}
    initialFocusSelector={operationReview && review.conflicts.length === 1 ? '.settings-conflict-choice input' : undefined}
  >
    <div className={`form-stack settings-conflict-review${operationReview ? ' is-operations' : ''}`}>
      <p>{'As configura\u00e7\u00f5es foram alteradas em outro dispositivo. Suas altera\u00e7\u00f5es foram mantidas para revis\u00e3o.'}</p>
      {operationReview ? <div className="operation-conflict-summary" role="status">
        <strong>{review.conflicts.length === 1 ? '1 diferen\u00e7a encontrada' : `${review.conflicts.length} diferen\u00e7as encontradas`}</strong>
        <span>{review.conflicts.length ? 'Escolha qual valor deve ser mantido em cada campo.' : 'As altera\u00e7\u00f5es podem ser combinadas sem escolha manual.'}</span>
      </div> : <div className="settings-conflict-columns" role="group" aria-label={'Compara\u00e7\u00e3o da configura\u00e7\u00e3o'}>
        <section><h3>{'Atual no neg\u00f3cio'}</h3><p>{readable(review.current)}</p></section>
        <section><h3>Seu ajuste</h3><p>{readable(review.draft)}</p></section>
        <section><h3>Escolha para salvar</h3><p>{review.conflicts.length ? 'Revise cada diferen\u00e7a abaixo.' : 'A proposta combina altera\u00e7\u00f5es sem colis\u00e3o.'}</p></section>
      </div>}
      {operationReview ? review.conflicts.map((conflict) => <OperationConflictItem
        key={conflict.id}
        conflict={conflict}
        choice={choices[conflict.id]}
        onChoice={(choice) => setChoices((current) => ({ ...current, [conflict.id]: choice }))}
      />) : review.conflicts.map((conflict) => <fieldset key={conflict.id} className="settings-conflict-item">
        <legend>{conflict.path}</legend>
        <p>{conflict.message}</p>
        {conflict.choices.includes('current') && conflict.choices.length > 1 && <label>
          <input type="radio" name={conflict.id} aria-label={`Usar valor atual para ${conflict.path}`} checked={choices[conflict.id] === 'current'} onChange={() => setChoices((current) => ({ ...current, [conflict.id]: 'current' }))} />
          {`Atual no neg\u00f3cio: ${readable(conflict.current, conflict.currentExists)}`}
        </label>}
        {conflict.choices.includes('draft') && <label>
          <input type="radio" name={conflict.id} aria-label={`Usar seu ajuste para ${conflict.path}`} checked={choices[conflict.id] === 'draft'} onChange={() => setChoices((current) => ({ ...current, [conflict.id]: 'draft' }))} />
          {`Seu ajuste: ${readable(conflict.draft, conflict.draftExists)}`}
        </label>}
      </fieldset>)}
      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={close} disabled={accepting}>Continuar editando</Button>
        <Button type="button" onClick={accept} disabled={disabled || accepting || unresolved}>{'Aplicar revis\u00e3o'}</Button>
      </div>
      <p className="helper-text">{'Depois de aplicar a revis\u00e3o, use Salvar altera\u00e7\u00f5es novamente para criar uma nova tentativa.'}</p>
    </div>
  </Modal>
}

export default SettingsConflictReview
