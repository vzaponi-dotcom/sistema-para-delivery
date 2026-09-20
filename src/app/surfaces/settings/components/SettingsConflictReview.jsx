import { useMemo, useRef, useState } from 'react'
import { resolvePolicyConflict } from '../../../policy-editing/policyConflict.js'
import { conflictReviewSummary, describeSettingsConflict } from '../conflicts/settingsConflictPresentation.js'
import Button from '../../../../shared/ui/Button'
import Modal from '../../../../shared/ui/Modal'

const operationConflictKey = (conflict) => conflict.segments.map((segment) => (
  typeof segment === 'object' ? `[${segment.id}]` : segment
)).join('.')

function FriendlyConflictItem({ review, conflict, choice, onChoice }) {
  const description = describeSettingsConflict(review, conflict)
  const needsChoice = conflict.choices.length > 1

  return <fieldset
    className="settings-conflict-item operation-conflict-item"
    data-operation-conflict={review.resource === 'operations' ? operationConflictKey(conflict) : undefined}
  >
    <legend>{description.label}</legend>
    <p className="settings-conflict-message">{description.message}</p>
    {needsChoice ? <div className="settings-conflict-choices">
      {conflict.choices.includes('current') && <label className="settings-conflict-choice">
        <input
          type="radio"
          name={conflict.id}
          aria-label={`Usar valor atual para ${description.label}`}
          checked={choice === 'current'}
          onChange={() => onChoice('current')}
        />
        <span><small>Atual no negócio</small><strong className="settings-conflict-value">{description.current}</strong></span>
      </label>}
      {conflict.choices.includes('draft') && <label className="settings-conflict-choice">
        <input
          type="radio"
          name={conflict.id}
          aria-label={`Usar seu ajuste para ${description.label}`}
          checked={choice === 'draft'}
          onChange={() => onChoice('draft')}
        />
        <span><small>Seu ajuste</small><strong className="settings-conflict-value">{description.draft}</strong></span>
      </label>}
    </div> : <div className="settings-conflict-auto-choice" role="status">
      <strong>{conflict.choices[0] === 'draft' ? description.draft : description.current}</strong>
      <small>Esta regra será preservada automaticamente na revisão.</small>
    </div>}
  </fieldset>
}

function PrimaryStationConflictItem({ conflict, choice, onChoice }) {
  return <fieldset className="settings-conflict-item operation-conflict-item" data-primary-station-conflict="true">
    <legend>Estação principal</legend>
    <p className="settings-conflict-message">Outra estação foi definida como principal enquanto você editava. Escolha qual deve permanecer como principal.</p>
    <div className="settings-conflict-choices">
      {conflict.choices.includes('current') && conflict.choices.length > 1 && <label className="settings-conflict-choice">
        <input
          type="radio"
          name={conflict.id}
          aria-label="Manter a estação principal atual"
          checked={choice === 'current'}
          onChange={() => onChoice('current')}
        />
        <span>
          <strong className="settings-conflict-value">Manter a estação principal atual</strong>
          <small>Mantém a definição que está ativa no negócio agora.</small>
        </span>
      </label>}
      {conflict.choices.includes('draft') && <label className="settings-conflict-choice">
        <input
          type="radio"
          name={conflict.id}
          aria-label="Tornar esta estação a principal"
          checked={choice === 'draft'}
          onChange={() => onChoice('draft')}
        />
        <span>
          <strong className="settings-conflict-value">Tornar esta estação a principal</strong>
          <small>Substitui a estação principal atual por este equipamento.</small>
        </span>
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
  const primaryStationReview = review.resource === 'stationPrimary'
  const anonymousCompatibleReview = !review.resource && review.conflicts.length === 0
  const summary = conflictReviewSummary(review)
  const unresolved = review.conflicts.some((conflict) => conflict.choices.length > 1 && !choices[conflict.id])
  const hasManualChoice = review.conflicts.some((conflict) => conflict.choices.length > 1)
  const close = () => { if (!acceptingRef.current) onClose?.() }
  const accept = async () => {
    if (disabled || unresolved || acceptingRef.current) return false
    acceptingRef.current = true
    setAccepting(true)
    try {
      const candidate = resolvePolicyConflict(review, choices)
      await onAccept?.(candidate)
      return true
    } finally {
      acceptingRef.current = false
      setAccepting(false)
    }
  }

  return <Modal
    title="Revisar alterações"
    onClose={close}
    className="settings-conflict-modal"
    initialFocusSelector={review.conflicts.length === 1 && hasManualChoice ? '.settings-conflict-choice input' : undefined}
  >
    <div className={`form-stack settings-conflict-review is-friendly${review.resource === 'operations' ? ' is-operations' : ''}${primaryStationReview ? ' is-primary-station' : ''}`}>
      <p>As configurações foram alteradas em outro dispositivo. Suas alterações foram mantidas para revisão.</p>
      {primaryStationReview && review.conflicts.length ? <div className="settings-conflict-summary operation-conflict-summary" role="status">
        <strong>Conflito na estação principal</strong>
        <span>Escolha qual definição deve ser mantida antes de salvar novamente.</span>
      </div> : <div className="settings-conflict-summary operation-conflict-summary" role="status">
        <strong>{summary.title}</strong>
        <span>{summary.description}</span>
        {summary.detail && <small>{summary.detail}</small>}
        {anonymousCompatibleReview && <small>Atual no negócio · Seu ajuste · Escolha para salvar</small>}
      </div>}
      {primaryStationReview ? review.conflicts.map((conflict) => <PrimaryStationConflictItem
        key={conflict.id}
        conflict={conflict}
        choice={choices[conflict.id]}
        onChoice={(choice) => setChoices((current) => ({ ...current, [conflict.id]: choice }))}
      />) : review.conflicts.map((conflict) => <FriendlyConflictItem
        key={conflict.id}
        review={review}
        conflict={conflict}
        choice={choices[conflict.id]}
        onChoice={(choice) => setChoices((current) => ({ ...current, [conflict.id]: choice }))}
      />)}
      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={close} disabled={accepting}>Continuar editando</Button>
        <Button type="button" onClick={accept} disabled={disabled || accepting || unresolved}>Aplicar revisão</Button>
      </div>
      <p className="helper-text">Depois de aplicar a revisão, use Salvar alterações novamente para criar uma nova tentativa.</p>
    </div>
  </Modal>
}

export default SettingsConflictReview
