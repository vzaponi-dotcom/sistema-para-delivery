import { useId, useRef, useState } from 'react'
import Button from './Button'
import Modal from './Modal'
import SystemSelect from './SystemSelect'

const details = {
  cancellation: { title: 'Adicionar motivo de cancelamento', label: 'Motivo' },
  finance: { title: 'Adicionar categoria financeira', label: 'Categoria' },
}

const financeTypes = [
  { value: 'entrada', label: 'Entrada' },
  { value: 'saida', label: 'Saída' },
]

const initialFields = (kind, initialValue) => kind === 'finance' && initialValue && typeof initialValue === 'object'
  ? { label: initialValue.label || '', type: initialValue.type || 'entrada' }
  : { label: typeof initialValue === 'string' ? initialValue : '', type: 'entrada' }

function SettingsItemDialogContent({ kind, initialValue, onAdd, onClose }) {
  const initial = initialFields(kind, initialValue)
  const [value, setValue] = useState(initial.label)
  const [type, setType] = useState(initial.type)
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
    const result = onAdd(kind === 'finance' ? { label: nextValue, type } : nextValue)
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
  return <Modal title={detail.title} onClose={onClose} footer={<><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button type="button" onClick={submit}>Adicionar à lista</Button></>}>
    <label className="form-field"><span>{detail.label}</span><input ref={inputRef} autoFocus type="text" maxLength={80} value={value} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => { setValue(event.target.value); setError('') }} /></label>
    {kind === 'finance' && <div className="form-field"><span>Tipo</span><SystemSelect label="Tipo" value={type} options={financeTypes} onChange={setType} disabled={Boolean(initial.label)} /></div>}
    {error && <p id={errorId} className="settings-state-message settings-state-error" role="alert">{error}</p>}
  </Modal>
}

function SettingsItemDialog({ open, kind, initialValue = '', onAdd, onClose }) {
  if (!open) return null
  return <SettingsItemDialogContent key={`${kind}:${initialValue}`} kind={kind} initialValue={initialValue} onAdd={onAdd} onClose={onClose} />
}

export default SettingsItemDialog
