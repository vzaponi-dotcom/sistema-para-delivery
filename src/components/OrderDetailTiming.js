import { FINANCE_TIME_ZONE } from '../../shared/finance.js'
import { getOperationalDurationMinutes, getOperationalStartAt } from '../../shared/orderTiming.js'
import { formatElapsedDuration } from '../utils/orderWorkflow.js'

const formatTime = (value) => new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: FINANCE_TIME_ZONE,
}).format(new Date(value))

const formatDateTime = (value) => new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short', timeStyle: 'short', hourCycle: 'h23', timeZone: FINANCE_TIME_ZONE,
}).format(new Date(value)).replace(',', ' às')

export const buildOrderDetailTimingRows = (order) => {
  const rows = []
  if (order?.scheduledFor) rows.push({ key: 'desired', label: 'Horário desejado', value: formatTime(order.scheduledFor) })
  const operationalStartAt = getOperationalStartAt(order)
  if (operationalStartAt) rows.push({ key: 'operational-start', label: 'Início operacional', value: formatDateTime(operationalStartAt) })
  const duration = getOperationalDurationMinutes(order)
  if (duration !== null) rows.push({
    key: 'duration',
    label: order?.type === 'Entrega' ? 'Tempo até sair para entrega' : 'Tempo até finalização',
    value: formatElapsedDuration(duration),
  })
  return rows
}
