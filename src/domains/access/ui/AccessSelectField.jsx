import { useId } from 'react'
import SystemSelect from '../../../shared/ui/SystemSelect'

export default function AccessSelectField(props) {
  const id = useId()
  return <div className="access-select-field"><label htmlFor={id}>{props.label}</label><SystemSelect {...props} id={id} /></div>
}
