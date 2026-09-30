import Icon from '../../../../shared/ui/Icon'
import { FINANCE_TIME_ZONE } from '../../../../../shared/finance.js'

export function OrderTiming({ scheduledFor, orderDate, type }) {
  const label = scheduledFor
    ? new Intl.DateTimeFormat('pt-BR', { timeZone: FINANCE_TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(scheduledFor))
    : String(orderDate || '').split('-').reverse().join('/')
  return <span className={`new-order-timing${scheduledFor ? ' scheduled' : ''}`}><Icon name={scheduledFor ? 'calendar' : 'clock'} size={16} />{scheduledFor ? `${type === 'Local' ? 'Reserva' : 'Agendado'} · ${label}` : `${orderDate ? 'Data do pedido · ' : 'Para agora'}${label}`}</span>
}

export default function NewOrderContext({ customerSummary, displayName, type, orderDate, scheduledFor, onEdit, disabled }) {
  return <div className="new-order-context-strip"><span className="new-order-context-icon"><Icon name={type === 'Local' ? 'table' : 'client'} size={20} /></span><div className="new-order-context-copy"><strong>{displayName || customerSummary}</strong><small>{type === 'Local' ? 'Consumo no local' : type}{scheduledFor ? ' · Atendimento agendado' : ' · Novo pedido'}</small></div><OrderTiming {...{ scheduledFor, orderDate, type }} />{onEdit && <button type="button" className="new-order-context-edit" onClick={onEdit} disabled={disabled}><Icon name="edit" size={16} />Editar</button>}</div>
}
