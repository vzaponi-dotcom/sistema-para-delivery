const statusClass = (status) => String(status || 'Em preparo').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')

function StatusBadge({ status, label }) {
  const value = status || 'Em preparo'
  return <span className={`status-badge status-${statusClass(value)}`}>{label || value}</span>
}

export default StatusBadge
