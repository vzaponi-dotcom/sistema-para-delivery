import { useMemo, useRef, useState } from 'react'
import { resolveSettingsConflict } from '../app/settingsConflict.js'
import Button from './Button'
import Modal from './Modal'

const readable = (value, exists = true) => {
  if (!exists) return 'Item removido'
  if (value === null) return 'Nenhum'
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'Ativo' : 'Inativo'
  if (Array.isArray(value)) return value.map((item) => item?.label || item?.id || String(item)).join(' → ')
  return JSON.stringify(value)
}

function SettingsConflictReview({ review, onAccept, onClose, disabled = false }) {
  const initialChoices = useMemo(() => Object.fromEntries(
    (review?.conflicts || []).filter(({ choices }) => choices.length === 1).map((conflict) => [conflict.id, conflict.choices[0]]),
  ), [review])
  const [choices, setChoices] = useState(initialChoices)
  const [accepting, setAccepting] = useState(false)
  const acceptingRef = useRef(false)

  if (!review) return null
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

  return (
    <Modal title="Revisar alterações" onClose={close}>
      <div className="form-stack settings-conflict-review">
        <p>As configurações foram alteradas em outro dispositivo. Suas alterações foram mantidas para revisão.</p>
        <div className="settings-conflict-columns" role="group" aria-label="Comparação da configuração">
          <section><h3>Atual no negócio</h3><p>{readable(review.current)}</p></section>
          <section><h3>Seu ajuste</h3><p>{readable(review.draft)}</p></section>
          <section><h3>Escolha para salvar</h3><p>{review.conflicts.length ? 'Revise cada diferença abaixo.' : 'A proposta combina alterações sem colisão.'}</p></section>
        </div>
        {review.conflicts.map((conflict) => (
          <fieldset key={conflict.id} className="settings-conflict-item">
            <legend>{conflict.path}</legend>
            <p>{conflict.message}</p>
            {conflict.choices.includes('current') && conflict.choices.length > 1 && (
              <label>
                <input
                  type="radio"
                  name={conflict.id}
                  aria-label={`Usar valor atual para ${conflict.path}`}
                  checked={choices[conflict.id] === 'current'}
                  onChange={() => setChoices((current) => ({ ...current, [conflict.id]: 'current' }))}
                />
                {`Atual no negócio: ${readable(conflict.current, conflict.currentExists)}`}
              </label>
            )}
            {conflict.choices.includes('draft') && (
              <label>
                <input
                  type="radio"
                  name={conflict.id}
                  aria-label={`Usar seu ajuste para ${conflict.path}`}
                  checked={choices[conflict.id] === 'draft'}
                  onChange={() => setChoices((current) => ({ ...current, [conflict.id]: 'draft' }))}
                />
                {`Seu ajuste: ${readable(conflict.draft, conflict.draftExists)}`}
              </label>
            )}
          </fieldset>
        ))}
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={close} disabled={accepting}>Continuar editando</Button>
          <Button type="button" onClick={accept} disabled={disabled || accepting || unresolved}>Aplicar revisão</Button>
        </div>
        <p className="helper-text">Depois de aplicar a revisão, use Salvar alterações novamente para criar uma nova tentativa.</p>
      </div>
    </Modal>
  )
}

export default SettingsConflictReview
