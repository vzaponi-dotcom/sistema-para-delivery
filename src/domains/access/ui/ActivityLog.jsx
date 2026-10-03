import { useContextApi } from '../../../infrastructure/api/ContextApi.js'
import { useEffect, useState } from 'react'
import { actionLabel, outcomeLabel } from './accessLabels.js'
import { AUDIT_ACTIONS } from '../../../../shared/auditActions.js'
import { actorLabel } from '../../../shared/actorLabel.js'
import Button from '../../../shared/ui/Button'
import PageHeader from '../../../shared/ui/PageHeader'
import AccessSelectField from './AccessSelectField'
import Icon from '../../../shared/ui/Icon'
import { accessApi, createAccessApi } from '../infrastructure/accessApi.js'
import { useAccessRequest } from './useAccessRequest.js'
import './access.css'

const emptyFilters = { userId: '', from: '', to: '', type: '' }
export default function ActivityLog({ sessionContext, api: suppliedApi = accessApi, onApiError, canOpenResource, onOpenResource }) {
  const api = useContextApi(createAccessApi, suppliedApi, accessApi)
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
  const groups = new Map()
  for (const item of state.activity?.items || []) {
    const day = new Date(item.occurredAt).toLocaleDateString('pt-BR')
    if (!groups.has(day)) groups.set(day, [])
    groups.get(day).push(item)
  }
  const resourceLabels = { order: 'Pedido', user: 'Conta', payment: 'Pagamento', printing_job: 'Impressão', table_tab: 'Comanda' }
  return <div className="settings-page access-page"><PageHeader eyebrow="Configurações" title="Atividades" description="Acompanhe as ações da equipe e os registros da operação." />
    <section className="surface-card access-section"><form className="access-form access-activity-filters" aria-busy={Boolean(state.pending)} onSubmit={event => { event.preventDefault(); void load() }}>
      <AccessSelectField label="Pessoa" value={filters.userId} options={[{ value: '', label: 'Todas' }, ...(state.users || []).map(user => ({ value: user.id, label: user.displayName }))]} onChange={userId => setDraft({ ...filters, owner: sessionContext, userId })} />
      {['from', 'to'].map(name => <label key={name}>{name === 'from' ? 'De' : 'Até'}<input type="date" name={name} value={filters[name]} onChange={event => setDraft({ ...filters, owner: sessionContext, [name]: event.target.value })} /></label>)}
      <AccessSelectField label="Tipo" value={filters.type} options={[{ value: '', label: 'Todos' }, ...AUDIT_ACTIONS.map(action => ({ value: action, label: actionLabel(action) }))]} onChange={type => setDraft({ ...filters, owner: sessionContext, type })} /><Button type="submit" disabled={state.pending}>Filtrar</Button>
    </form>{state.error && <p className="access-feedback access-feedback-error" role="alert">{state.error}</p>}{state.pending && <p role="status">Carregando atividades…</p>}
    {[...groups].map(([day, items]) => <section className="access-activity-day" key={day} aria-label={`Atividades de ${day}`}><h2>{day}</h2><ol className="access-activity">{items.map(item => <li key={item.id}>
      <span className="access-event-icon" aria-hidden="true"><Icon name={item.outcome === 'denied' || item.outcome === 'blocked' ? 'shield' : item.action.startsWith('order.') ? 'orders' : item.action.startsWith('printing.') ? 'printer' : item.action.startsWith('access.') ? 'clients' : 'clock'} size={18} /></span>
      <div className="access-event-copy"><strong>{actionLabel(item.action)}</strong><p>{actorLabel(item.actor)}</p><span className={`access-status ${item.outcome === 'success' ? 'is-active' : item.outcome === 'denied' || item.outcome === 'blocked' ? 'is-pending' : 'is-inactive'}`}>{outcomeLabel(item.outcome)}</span></div>
      <div className="access-event-actions"><time dateTime={item.occurredAt}>{new Date(item.occurredAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time>{canOpenResource?.(item) && <Button variant="secondary" onClick={() => { if (owns() && canOpenResource(item)) onOpenResource?.(item) }}>Abrir detalhe</Button>}</div>
      {item.resourceId && <details className="access-event-reference"><summary>Referência do registro</summary><small>{resourceLabels[item.resourceType] || item.resourceType}: {item.resourceId}</small></details>}
    </li>)}</ol></section>)}
    {state.activity?.items.length === 0 && <div className="access-empty"><Icon name="clock" size={28} /><h3>Nenhuma atividade encontrada</h3><p>Experimente outro período, pessoa ou tipo de ação.</p></div>}<div className="access-pagination"><Button variant="secondary" disabled={state.pending || !state.activity?.nextCursor} onClick={() => load(state.activity.nextCursor)}>Próxima página</Button></div></section>
  </div>
}
