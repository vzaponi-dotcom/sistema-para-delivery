import { useEffect, useState } from 'react'
import { actionLabel, outcomeLabel } from './accessLabels.js'
import { AUDIT_ACTIONS } from '../../../../shared/auditActions.js'
import { actorLabel } from '../../../shared/actorLabel.js'
import Button from '../../../shared/ui/Button'
import PageHeader from '../../../shared/ui/PageHeader'
import SystemSelect from '../../../shared/ui/SystemSelect'
import { accessApi } from '../infrastructure/accessApi.js'
import { useAccessRequest } from './useAccessRequest.js'
import './access.css'

const emptyFilters = { userId: '', from: '', to: '', type: '' }
export default function ActivityLog({ sessionContext, api = accessApi, onApiError, canOpenResource, onOpenResource }) {
  const canView = sessionContext?.capabilities?.includes('access.audit.view')
  const canListUsers = sessionContext?.capabilities?.includes('access.users.view')
  const { state, patch, run, owns } = useAccessRequest(sessionContext, onApiError)
  const [draft, setDraft] = useState({ owner: sessionContext, ...emptyFilters })
  const filters = draft.owner === sessionContext ? draft : emptyFilters
  useEffect(() => {
    if (!canView) return
    void run(async () => {
      const activity = await api.listActivity()
      const team = canListUsers ? await api.listUsers() : { users: [] }
      return { activity, users: team.users }
    }, result => patch({ ...result, filters: {} }))
  }, [api, canListUsers, canView, patch, run])
  if (!canView) return <p role="alert">Acesso negado.</p>
  const load = cursor => {
    const selected = cursor ? state.filters : { userId: filters.userId, type: filters.type, from: filters.from ? `${filters.from}T00:00:00-03:00` : '', to: filters.to ? `${filters.to}T23:59:59.999-03:00` : '' }
    return run(() => api.listActivity({ ...selected, cursor }), activity => patch({ activity, filters: selected }))
  }
  return <div className="settings-page access-page"><PageHeader eyebrow="Configurações" title="Atividades" description="Ações registradas pelo servidor." />
    <section className="surface-card access-section"><form className="access-form" aria-busy={Boolean(state.pending)} onSubmit={event => { event.preventDefault(); void load() }}>
      <SystemSelect label="Pessoa" value={filters.userId} options={[{ value: '', label: 'Todas' }, ...(state.users || []).map(user => ({ value: user.id, label: user.displayName }))]} onChange={userId => setDraft({ ...filters, owner: sessionContext, userId })} />
      {['from', 'to'].map(name => <label key={name}>{name === 'from' ? 'De' : 'Até'}<input type="date" name={name} value={filters[name]} onChange={event => setDraft({ ...filters, owner: sessionContext, [name]: event.target.value })} /></label>)}
      <SystemSelect label="Tipo" value={filters.type} options={[{ value: '', label: 'Todos' }, ...AUDIT_ACTIONS.map(action => ({ value: action, label: actionLabel(action) }))]} onChange={type => setDraft({ ...filters, owner: sessionContext, type })} /><Button type="submit" disabled={state.pending}>Filtrar</Button>
    </form>{state.error && <p role="alert">{state.error}</p>}{state.pending && <p role="status">Carregando atividades…</p>}
    <ol className="access-activity">{state.activity?.items.map(item => <li key={item.id}><strong>{actorLabel(item.actor)}</strong><p>{actionLabel(item.action)} · {outcomeLabel(item.outcome)}</p><time dateTime={item.occurredAt}>{new Date(item.occurredAt).toLocaleString('pt-BR')}</time>{item.resourceId && <small>{item.resourceType}: {item.resourceId}</small>}{canOpenResource?.(item) && <Button variant="secondary" onClick={() => { if (owns() && canOpenResource(item)) onOpenResource?.(item) }}>Abrir detalhe</Button>}</li>)}</ol>
    {state.activity?.items.length === 0 && <p>Nenhuma atividade encontrada.</p>}<Button variant="secondary" disabled={state.pending || !state.activity?.nextCursor} onClick={() => load(state.activity.nextCursor)}>Próxima página</Button></section>
  </div>
}
