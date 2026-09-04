import Icon from './Icon'

function StatCard({ label, value, helper, icon = 'dashboard', tone = 'neutral', action = null }) {
  return (
    <article className={`stat-card tone-${tone}`}>
      <div className="stat-icon"><Icon name={icon} size={20} /></div>
      <div className="stat-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        {helper && <small>{helper}</small>}
        {action && <div className="stat-action">{action}</div>}
      </div>
    </article>
  )
}

export default StatCard
