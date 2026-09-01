const statusClass = (status) => String(status || 'Em preparo').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')

function StatusBadge({ status }) {
  const value = status || 'Em preparo'
  return <span className={`status-badge status-${statusClass(value)}`}>{value}</span>
}

export default StatusBadge
