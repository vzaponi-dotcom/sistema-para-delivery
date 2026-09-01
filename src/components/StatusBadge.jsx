const statusClass = (status) => String(status || 'Pendente').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')

function StatusBadge({ status }) {
  const value = status || 'Pendente'
  return <span className={`status-badge status-${statusClass(value)}`}>{value}</span>
}

export default StatusBadge
