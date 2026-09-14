import { useId, useRef, useState } from 'react'
import Button from './Button'
import Modal from './Modal'
import SystemSelect from './SystemSelect'

const details = {
  cancellation: { addTitle: 'Adicionar motivo de cancelamento', editTitle: 'Renomear motivo de cancelamento', label: 'Motivo' },
  finance: { addTitle: 'Adicionar categoria financeira', editTitle: 'Renomear categoria financeira', label: 'Categoria' },
}

const financeTypes = [
  { value: 'entrada', label: 'Entrada' },
  { value: 'saida', label: 'Saída' },
]

const initialFields = (kind, initialValue) => initialValue && typeof initialValue === 'object'
  ? { label: initialValue.label || '', type: initialValue.type || 'entrada', active: initialValue.active !== false, structured: true }
  : { label: typeof initialValue === 'string' ? initialValue : '', type: 'entrada', active: true, structured: false }

function SettingsItemDialogContent({ kind, mode, initialValue, onAdd, onClose }) {
  const initial = initialFields(kind, initialValue)
  const [value, setValue] = useState(initial.label)
  const [type, setType] = useState(initial.type)
  const [active, setActive] = useState(initial.active)
  const [error, setError] = useState('')
  const inputRef = useRef(null)
  const errorId = useId()
  const detail = details[kind]
  const showError = (message) => {
    setError(message)
    inputRef.current?.focus()
  }
  const submit = () => {
    const nextValue = value.trim()
    if (!nextValue) {
      showError('Informe um nome.')
      return
    }
    const result = onAdd(initial.structured
      ? { label: nextValue, ...(kind === 'finance' ? { type } : { active }) }
      : kind === 'finance' ? { label: nextValue, type } : nextValue)
    if (typeof result === 'string' && result) {
      showError(result)
      return
    }
    if (result === false) {
      showError('Não foi possível adicionar este item.')
      return
    }
    onClose()
  }
  const submitLabel = mode === 'edit'
    ? kind === 'cancellation' ? 'Atualizar motivo' : 'Aplicar ao rascunho'
    : 'Adicionar à lista'
  return <Modal title={mode === 'edit' ? detail.editTitle : detail.addTitle} onClose={onClose} footer={<><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button type="button" onClick={submit}>{submitLabel}</Button></>}>
    <label className="form-field"><span>{detail.label}</span><input ref={inputRef} autoFocus type="text" maxLength={80} value={value} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => { setValue(event.target.value); setError('') }} /></label>
    {kind === 'finance' && <div className="form-field"><span>Tipo</span><SystemSelect label="Tipo" value={type} options={financeTypes} onChange={setType} disabled={Boolean(initial.label)} /></div>}
    {kind === 'cancellation' && mode !== 'edit' && <label className="settings-dialog-active"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /><span>Adicionar como ativo</span></label>}
    {error && <p id={errorId} className="settings-state-message settings-state-error" role="alert">{error}</p>}
  </Modal>
}

function SettingsItemDialog({ open, kind, mode = 'add', initialValue = '', onAdd, onClose }) {
  if (!open) return null
  const resetKey = typeof initialValue === 'object' ? `${initialValue.label || ''}:${initialValue.type || ''}:${initialValue.active !== false}` : initialValue
  return <SettingsItemDialogContent key={`${kind}:${mode}:${resetKey}`} kind={kind} mode={mode} initialValue={initialValue} onAdd={onAdd} onClose={onClose} />
}

export default SettingsItemDialog
