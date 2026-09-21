import Icon from './Icon'

function StatCard({ label, value, helper, icon = 'dashboard', tone = 'neutral', className = '' }) {
  const classes = ['stat-card', `tone-${tone}`, className].filter(Boolean).join(' ')
  return (
    <article className={classes}>
      <div className="stat-icon"><Icon name={icon} size={20} /></div>
      <div className="stat-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        {helper && <small>{helper}</small>}
      </div>
    </article>
  )
}

export default StatCard
