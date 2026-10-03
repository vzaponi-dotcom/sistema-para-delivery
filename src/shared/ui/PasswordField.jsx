import { useId, useState } from 'react'
import Icon from './Icon'
import './password-field.css'

export default function PasswordField({ label, hint, ...props }) {
  const generatedId = useId()
  const id = props.id || generatedId
  const [visible, setVisible] = useState(false)
  return <div className="access-password-field"><label htmlFor={id}>{label}</label>
    <div className="access-password-input"><input {...props} id={id} type={visible ? 'text' : 'password'} aria-describedby={hint ? `${id}-hint` : undefined} />
      <button type="button" className="access-password-toggle" disabled={props.disabled} aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible(value => !value)}><Icon name={visible ? 'eye-off' : 'eye'} size={18} /></button>
    </div>{hint && <small id={`${id}-hint`}>{hint}</small>}
  </div>
}
