import { useState } from 'react'
import {
  PAYMENT_METHODS,
  getManualMovementCategoryOptions,
  getMovementCategoryLabel,
  isManualMovementCategory,
} from '../../shared/finance.js'
import {
  formatBRLCurrencyInput,
  formatBRLCurrencyValue,
  parseBRLCurrencyInput,
} from '../utils/formFormatting.js'
import Button from './Button'
import ConfirmationDialog from './ConfirmationDialog'
import Modal from './Modal'
import SystemSelect from './SystemSelect'

const TYPE_OPTIONS = [
  { value: 'entrada', label: 'Entrada' },
  { value: 'saida', label: 'Saída' },
]
const PAYMENT_OPTIONS = PAYMENT_METHODS.map((value) => ({ value, label: value }))

const buildDraft = (movement, today) => ({
  type: movement?.type || 'entrada',
  category: movement?.source === 'manual' ? movement.category || '' : '',
  description: movement?.description || '',
  value: formatBRLCurrencyValue(movement?.value ?? 0),
  movementDate: movement?.movementDate || movement?.date || today,
  paymentMethod: movement?.paymentMethod || '',
})

function MovementDialogContent({ movement, today, disabled, onClose, onSubmit }) {
  const [draft, setDraft] = useState(() => buildDraft(movement, today))
  const [review, setReview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const editing = Boolean(movement?.id)
  const locked = disabled || submitting
  const categoryOptions = getManualMovementCategoryOptions(draft.type)
  const parsedValue = parseBRLCurrencyInput(draft.value)
  const canReview = Boolean(
    draft.category
    && draft.description.trim()
    && parsedValue > 0
    && draft.movementDate
    && draft.paymentMethod,
  )

  const updateField = (field, value) => setDraft((current) => ({ ...current, [field]: value }))
  const changeType = (nextType) => setDraft((current) => ({
    ...current,
    type: nextType,
    category: isManualMovementCategory(nextType, current.category) ? current.category : '',
  }))

  const handleReview = (event) => {
    event.preventDefault()
    if (!canReview || locked) return
    setReview({
      type: draft.type,
      category: draft.category,
      description: draft.description.trim(),
      value: parsedValue,
      movementDate: draft.movementDate,
      paymentMethod: draft.paymentMethod,
    })
  }

  const handleConfirm = async () => {
    if (!review || locked) return
    setSubmitting(true)
    try {
      const result = await onSubmit?.(review)
      if (result === false) return
      setReview(null)
      onClose?.()
    } finally {
      setSubmitting(false)
    }
  }

  if (review) {
    return (
      <ConfirmationDialog
        title={editing ? 'Confirmar alterações' : 'Confirmar movimentação'}
        message={editing ? 'Revise os dados antes de salvar as alterações.' : 'Revise os dados antes de registrar este movimento.'}
        details={(
          <div className="form-stack compact-stack">
            <strong>{review.type === 'entrada' ? 'Entrada' : 'Saída'} · {getMovementCategoryLabel(review)}</strong>
            <span>{formatBRLCurrencyValue(review.value)}</span>
            <small>{review.description}</small>
            <small>{review.movementDate} · {review.paymentMethod}</small>
          </div>
        )}
        confirmLabel={editing ? 'Salvar alterações' : 'Salvar movimento'}
        confirmVariant="primary"
        onConfirm={handleConfirm}
        onClose={() => setReview(null)}
        disabled={locked}
      />
    )
  }

  return (
    <Modal title={editing ? 'Editar movimento' : 'Registrar movimento'} onClose={locked ? () => {} : onClose}>
      <form className="form-stack movement-form" onSubmit={handleReview}>
        <label className="form-field">
          <span>Tipo</span>
          <SystemSelect
            value={draft.type}
            options={TYPE_OPTIONS}
            onChange={changeType}
            label="Tipo do movimento"
            disabled={locked}
          />
        </label>

        <label className="form-field">
          <span>Categoria</span>
          <SystemSelect
            value={draft.category}
            options={categoryOptions}
            onChange={(value) => updateField('category', value)}
            placeholder="Selecione uma categoria"
            label="Categoria"
            disabled={locked}
          />
        </label>

        <label className="form-field">
          <span>Descrição</span>
          <input
            value={draft.description}
            onChange={(event) => updateField('description', event.target.value)}
            placeholder="Ex.: Compra de embalagens"
            disabled={locked}
          />
        </label>

        <label className="form-field">
          <span>Valor</span>
          <input
            inputMode="decimal"
            value={draft.value}
            onChange={(event) => updateField('value', formatBRLCurrencyInput(event.target.value))}
            placeholder="R$ 0,00"
            disabled={locked}
          />
        </label>

        <label className="form-field">
          <span>Data do movimento</span>
          <input
            type="date"
            value={draft.movementDate}
            max={today}
            onChange={(event) => updateField('movementDate', event.target.value)}
            disabled={locked}
          />
        </label>

        <label className="form-field">
          <span>Forma / Meio</span>
          <SystemSelect
            value={draft.paymentMethod}
            options={PAYMENT_OPTIONS}
            onChange={(value) => updateField('paymentMethod', value)}
            placeholder="Selecione a forma / meio"
            label="Forma ou meio"
            disabled={locked}
          />
        </label>

        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={locked}>Cancelar</Button>
          <Button type="submit" disabled={locked || !canReview}>
            {editing ? 'Revisar alterações' : 'Revisar movimento'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function MovementDialog({ open, movement = null, today, disabled = false, onClose, onSubmit }) {
  if (!open) return null
  return (
    <MovementDialogContent
      key={`${movement?.id || 'new'}:${today}`}
      movement={movement}
      today={today}
      disabled={disabled}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  )
}

export default MovementDialog
