import { useEffect } from 'react'
import { capabilityLabel } from './accessLabels.js'
import Button from '../../../shared/ui/Button'
import PageHeader from '../../../shared/ui/PageHeader'
import Modal from '../../../shared/ui/Modal'
import SystemSelect from '../../../shared/ui/SystemSelect'
import { accessApi } from '../infrastructure/accessApi.js'
import { useAccessRequest } from './useAccessRequest.js'
import './access.css'

const statusLabel = user => !user.active ? 'Desativada' : ({ active: 'Ativa', reset_pending: 'Redefinição pendente', invited: 'Convite pendente' }[user.credentialState] || 'Não informado')
export default function TeamAccess({ sessionContext, api = accessApi, onApiError, refreshSession, writesBlocked = false }) {
  const canView = sessionContext?.capabilities?.includes('access.users.view')
  const canManage = sessionContext?.capabilities?.includes('access.users.manage')
  const { state, patch, run, owns } = useAccessRequest(sessionContext, onApiError)
  const draft = state.draft || { displayName: '', identifier: '', roleId: '' }
  const editing = state.editing || null
  const setDraft = value => patch({ draft: value })
  const setEditing = value => patch({ editing: value })
  const load = () => run(() => api.listUsers(), data => patch({ data }))
  useEffect(() => { if (canView) void run(() => api.listUsers(), data => patch({ data })) }, [api, canView, run, patch])
  if (!canView) return <p role="alert">Acesso negado.</p>
  const data = state.data || { users: [], roles: [] }
  const blocked = writesBlocked || state.pending
  const roleOptions = data.roles.filter(role => role.active !== false).map(role => ({ value: role.id, label: role.name }))
  const accept = async result => {
    patch({ data: { ...data, users: [...data.users.filter(user => user.id !== result.user.id), result.user] }, invite: result.invite || null })
    if (result.user.id === sessionContext.user?.id) await refreshSession?.()
  }
  const mutate = (operation) => {
    if (!canManage || blocked || !owns()) return false
    return run(operation, accept)
  }
  const submit = async event => {
    event.preventDefault()
    const result = await mutate(() => api.createUser({ ...draft, roleId: draft.roleId || data.roles.find(role => role.active !== false)?.id || '' }))
    if (result && owns()) setDraft({ displayName: '', identifier: '', roleId: '' })
  }
  return <div className="settings-page access-page">
    <PageHeader eyebrow="Configurações" title="Equipe e acessos" description="Contas individuais e perfis fixos de acesso." />
    {state.error && <p role="alert">{state.error}</p>}
    <Button variant="secondary" onClick={load} disabled={state.pending}>Atualizar equipe</Button>
    {state.pending && <p role="status">Aguarde…</p>}
    <section className="surface-card access-section" aria-label="Perfis de acesso">
      <h2>Perfis de acesso</h2>
      {data.roles.map(role => <details key={role.id}><summary>{role.name}</summary><ul>{role.capabilities.map(capability => <li key={capability}>{capabilityLabel(capability)}</li>)}</ul></details>)}
    </section>
    {canManage && <section className="surface-card access-section"><h2>Convidar pessoa</h2><form className="access-form" onSubmit={submit} aria-busy={Boolean(state.pending)}>
      <label>Nome<input name="displayName" required value={draft.displayName} onChange={event => setDraft({ ...draft, displayName: event.target.value })} /></label>
      <label>Identificador<input name="identifier" required autoComplete="off" value={draft.identifier} onChange={event => setDraft({ ...draft, identifier: event.target.value })} /></label>
      <SystemSelect label="Perfil" options={roleOptions} value={draft.roleId || roleOptions[0]?.value || ''} disabled={Boolean(blocked)} onChange={roleId => setDraft({ ...draft, roleId })} />
      <Button type="submit" disabled={blocked || !state.data}>Criar convite</Button>
    </form></section>}
    <section className="surface-card access-section" aria-label="Contas da equipe"><h2>Contas da equipe</h2>
      {state.data && data.users.length === 0 && <p>Nenhuma conta encontrada.</p>}
      {data.users.map(user => <article className="access-user" key={user.id}><div><strong>{user.displayName}</strong><p>{user.identifier} · {data.roles.find(role => role.id === user.roleId)?.name || user.roleName} · {statusLabel(user)}</p><small>Último acesso: {user.lastAccessAt ? new Date(user.lastAccessAt).toLocaleString('pt-BR') : 'Ainda não registrado'}</small>{user.invite && <p>Convite {user.invite.status === 'expired' ? 'expirado' : 'pendente'} · Validade: {new Date(user.invite.expiresAt).toLocaleString('pt-BR')}</p>}</div>
        {canManage && <div className="access-actions"><Button variant="secondary" disabled={blocked} onClick={() => setEditing({ ...user })}>Editar {user.displayName}</Button><Button variant="secondary" disabled={blocked} onClick={() => mutate(() => api.updateUser(user.id, { active: !user.active }))}>{user.active ? 'Desativar' : 'Ativar'} {user.displayName}</Button>{user.id !== sessionContext.user?.id && <Button variant="secondary" disabled={blocked} onClick={() => mutate(() => api.resetPassword(user.id))}>Redefinir senha de {user.displayName}</Button>}</div>}
      </article>)}
    </section>
    {canManage && editing && <Modal title="Editar conta" onClose={() => setEditing(null)}><label>Nome<input value={editing.displayName} onChange={event => setEditing({ ...editing, displayName: event.target.value })} /></label><SystemSelect label="Perfil" options={roleOptions} value={editing.roleId} disabled={Boolean(blocked)} onChange={roleId => setEditing({ ...editing, roleId })} /><Button disabled={blocked || !editing.displayName.trim()} onClick={async () => { const result = await mutate(() => api.updateUser(editing.id, { displayName: editing.displayName, roleId: editing.roleId })); if (result && owns()) setEditing(null) }}>Salvar conta</Button>{state.error && <p role="alert">{state.error}</p>}</Modal>}
    {state.invite && <Modal title="Convite de uso único" onClose={() => patch({ invite: null })}><p>Copie este token agora e entregue à pessoa. Ele aparece somente nesta confirmação e vale por 24 horas. A pessoa deve abrir /ativar-conta e colá-lo.</p><pre className="access-token">{state.invite.token}</pre><p>Validade: {new Date(state.invite.expiresAt).toLocaleString('pt-BR')}</p><Button onClick={() => patch({ invite: null })}>Fechar convite</Button></Modal>}
  </div>
}
