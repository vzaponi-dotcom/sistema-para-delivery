import { useId } from 'react'
import Button from './Button'
import '../settings.css'

function SettingsItemList({ items, getActions, onAction, label }) {
  const listId = useId()
  return <section className="settings-item-list" aria-label={label}>
    {items.map((item) => {
      const actions = getActions(item) || []
      return <article key={item.id} className="settings-item-row">
        <div className="settings-item-copy"><strong>{item.label}</strong>{item.active === false && <small>Inativo</small>}</div>
        {actions.length > 0 && <div className="settings-item-actions">{actions.map((action) => {
          const reasonId = action.disabledReason ? `${listId}-${item.id}-${action.id}-reason` : undefined
          return <span key={action.id} className="settings-item-action">
            <Button type="button" variant="secondary" disabled={Boolean(action.disabledReason)} title={action.disabledReason} aria-describedby={reasonId} onClick={() => onAction(item, action.id)}>{action.label}</Button>
            {action.disabledReason && <small id={reasonId}>{action.disabledReason}</small>}
          </span>
        })}</div>}
      </article>
    })}
  </section>
}

export default SettingsItemList
