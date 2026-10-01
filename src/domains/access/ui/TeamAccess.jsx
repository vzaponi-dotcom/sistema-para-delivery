import { useEffect, useRef } from 'react'
import { capabilityLabel } from './accessLabels.js'
import Button from '../../../shared/ui/Button'
import PageHeader from '../../../shared/ui/PageHeader'
import Modal from '../../../shared/ui/Modal'
import AccessSelectField from './AccessSelectField'
import Icon from '../../../shared/ui/Icon'
import { accessApi } from '../infrastructure/accessApi.js'
import { useAccessRequest } from './useAccessRequest.js'
import './access.css'

const statusLabel = user => !user.active ? 'Desativada' : ({ active: 'Ativa', reset_pending: 'Redefinição pendente', invited: 'Convite pendente' }[user.credentialState] || 'Não informado')
export default function TeamAccess({ sessionContext, api = accessApi, onApiError, refreshSession, writesBlocked = false }) {
  const canView = sessionContext?.capabilities?.includes('access.users.view')
  const canManage = sessionContext?.capabilities?.includes('access.users.manage')
  const { state, patch, run, owns } = useAccessRequest(sessionContext, onApiError)
  const openMenuRef = useRef(null)
  const draft = state.draft || { displayName: '', identifier: '', roleId: '' }
  const editing = state.editing || null
  const setDraft = value => patch({ draft: value })
  const focusActionTrigger = () => openMenuRef.current?.querySelector?.('summary')?.focus?.()
  const setEditing = value => { if (value && state.actionMenuId) focusActionTrigger(); return patch({ editing: value, actionMenuId: null }) }
  const load = () => { patch({ actionMenuId: null }); return run(() => api.listUsers(), data => patch({ data })) }
  useEffect(() => { if (canView) void run(() => api.listUsers(), data => patch({ data })) }, [api, canView, run, patch])
  useEffect(() => {
    if (!state.actionMenuId || typeof document === 'undefined') return undefined
    const onMouseDown = event => { if (!openMenuRef.current?.contains?.(event.target)) patch({ actionMenuId: null }) }
    const onKeyDown = event => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      openMenuRef.current?.querySelector?.('summary')?.focus?.()
      patch({ actionMenuId: null })
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('mousedown', onMouseDown); document.removeEventListener('keydown', onKeyDown) }
  }, [state.actionMenuId, patch])
  if (!canView) return <p role="alert">Acesso negado.</p>
  const data = state.data || { users: [], roles: [] }
  const blocked = writesBlocked || state.pending
  const roleOptions = data.roles.filter(role => role.active !== false).map(role => ({ value: role.id, label: role.name }))
  const defaultRole = roleOptions.find(role => role.value === 'operator' || role.value.endsWith(':operator'))?.value || roleOptions[0]?.value || ''
  const managerRole = roleId => data.roles.some(role => role.id === roleId && role.active !== false && role.capabilities.includes('access.users.manage'))
  const usableManager = user => user.active && user.credentialState === 'active' && managerRole(user.roleId)
  const isLastManager = user => usableManager(user) && data.users.filter(usableManager).length === 1
  const roleName = user => data.roles.find(role => role.id === user.roleId)?.name || user.roleName || 'Perfil não informado'
  const search = (state.search || '').trim().toLocaleLowerCase('pt-BR')
  const filteredUsers = data.users.filter(user => (!search || `${user.displayName} ${user.identifier}`.toLocaleLowerCase('pt-BR').includes(search)) && (!state.statusFilter || statusLabel(user) === state.statusFilter))
  const accept = async result => {
    patch({ data: { ...data, users: [...data.users.filter(user => user.id !== result.user.id), result.user] }, invite: result.invite || null, inviteUser: result.invite ? result.user : null, copied: false })
    if (result.user.id === sessionContext.user?.id) await refreshSession?.()
  }
  const mutate = (operation) => {
    if (!canManage || blocked || !owns()) return false
    return run(operation, accept)
  }
  const submit = async event => {
    event.preventDefault()
    const result = await mutate(() => api.createUser({ ...draft, roleId: draft.roleId || defaultRole }))
    if (result && owns()) patch({ draft: null, inviting: false })
  }
  const requestConfirmation = (kind, user) => {
    if (!canManage || blocked || !owns() || (isLastManager(user) && (kind === 'reset' || user.active)) || (kind === 'reset' && user.id === sessionContext.user?.id)) return
    focusActionTrigger()
    patch({ confirmation: { kind, user }, error: '', actionMenuId: null })
  }
  const confirmMutation = async () => {
    const confirmation = state.confirmation
    if (!confirmation || blocked || !owns()) return
    const user = data.users.find(item => item.id === confirmation.user.id)
    if (!user || (isLastManager(user) && (confirmation.kind === 'reset' || user.active))) return
    const result = await mutate(() => confirmation.kind === 'reset' ? api.resetPassword(user.id) : api.updateUser(user.id, { active: !user.active }))
    if (result && owns()) patch({ confirmation: null })
  }
  const copyInvite = async () => {
    if (!state.invite || !owns()) return
    try { await navigator.clipboard.writeText(state.invite.token); patch({ copied: true, copyError: '' }) }
    catch { patch({ copyError: 'Selecione o código e copie manualmente.' }) }
  }
  return <div className="settings-page access-page">
    <div className="access-page-heading"><PageHeader eyebrow="Configurações" title="Equipe e acessos" description="Organize quem participa da operação e o que cada pessoa pode acessar." /><div className="access-heading-actions"><Button variant="secondary" onClick={load} disabled={state.pending}>Atualizar equipe</Button>{canManage && <Button icon="plus" disabled={blocked || !state.data} onClick={() => patch({ inviting: true, draft: null, error: '', actionMenuId: null })}>Convidar pessoa</Button>}</div></div>
    {state.error && !state.inviting && !editing && !state.confirmation && <p className="access-feedback access-feedback-error" role="alert">{state.error}</p>}
    {state.pending && <p role="status">Aguarde…</p>}
    <section className="surface-card access-section" aria-label="Contas da equipe"><h2>Contas da equipe</h2>
      <div className="access-team-filters"><label className="access-search">Buscar pessoa<div><Icon name="search" size={18} /><input name="search" placeholder="Nome ou usuário de acesso" value={state.search || ''} onChange={event => patch({ search: event.target.value, actionMenuId: null })} /></div></label><AccessSelectField label="Estado da conta" options={[{ value: '', label: 'Todos os estados' }, ...['Ativa', 'Convite pendente', 'Redefinição pendente', 'Desativada'].map(value => ({ value, label: value }))]} value={state.statusFilter || ''} onChange={statusFilter => patch({ statusFilter, actionMenuId: null })} /></div>
      <div className="access-list-header" aria-hidden="true"><span>Pessoa</span><span>Perfil</span><span>Estado</span><span>Último acesso</span><span /></div>
      {state.data && filteredUsers.length === 0 && <div className="access-empty"><Icon name="clients" size={28} /><h3>Nenhuma pessoa encontrada</h3><p>{data.users.length ? 'Tente outro nome ou estado da conta.' : 'Convide a primeira pessoa para participar da operação.'}</p></div>}
      {filteredUsers.map(user => <article className="access-user" key={user.id}>
        <div className="access-person"><span className="access-avatar" aria-hidden="true">{user.displayName.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()}</span><div><strong>{user.displayName}</strong>{user.id === sessionContext.user?.id && <span className="access-you">Você</span>}<small>{user.identifier}</small></div></div>
        <span className="access-user-role">{roleName(user)}</span><span className={`access-status ${!user.active ? 'is-inactive' : user.credentialState === 'active' ? 'is-active' : 'is-pending'}`}>{statusLabel(user)}</span>
        <div className="access-last-seen"><span className="access-mobile-label">Último acesso: </span>{user.lastAccessAt ? new Date(user.lastAccessAt).toLocaleString('pt-BR') : 'Ainda não entrou'}{user.invite && <small>Convite {user.invite.status === 'expired' ? 'expirado' : 'pendente'} · {new Date(user.invite.expiresAt).toLocaleString('pt-BR')}</small>}</div>
        {canManage ? <details className="access-row-menu" open={state.actionMenuId === user.id} ref={state.actionMenuId === user.id ? openMenuRef : null}>
          <summary role="button" aria-expanded={state.actionMenuId === user.id} aria-label={`Ações de ${user.displayName}`} onClick={event => { event.preventDefault(); patch({ actionMenuId: state.actionMenuId === user.id ? null : user.id }) }}><Icon name="menu" size={18} /></summary>
          <div className="access-row-menu-content">
            <strong className="access-row-menu-person">{user.displayName}</strong>
            <Button variant="secondary" aria-label={`Editar ${user.displayName}`} disabled={blocked} onClick={() => { setEditing({ ...user }); patch({ error: '' }) }}>Editar</Button>
            <Button variant="secondary" aria-label={`${user.active ? 'Desativar conta de' : 'Ativar conta de'} ${user.displayName}`} disabled={blocked || isLastManager(user)} onClick={() => requestConfirmation('active', user)}>{user.active ? 'Desativar conta' : 'Ativar conta'}</Button>
            {user.id !== sessionContext.user?.id && <Button variant="secondary" aria-label={`Redefinir senha de ${user.displayName}`} disabled={blocked || isLastManager(user)} onClick={() => requestConfirmation('reset', user)}>Redefinir senha</Button>}
            {isLastManager(user) && <small>Mantenha pelo menos um gerente com acesso ativo.</small>}
          </div>
        </details> : <span />}
      </article>)}
    </section>
    <section className="surface-card access-section access-profiles" aria-label="Perfis de acesso"><div><h2>Perfis de acesso</h2><p className="access-muted">Os perfis são fixos nesta versão. Consulte o que cada um permite.</p></div>{data.roles.map(role => <details key={role.id}><summary>{role.name}</summary><ul>{role.capabilities.map(capability => <li key={capability}>{capabilityLabel(capability)}</li>)}</ul></details>)}</section>
    {canManage && state.inviting && <Modal title="Convidar pessoa" className="access-dialog" onClose={() => { if (!state.pending) patch({ inviting: false, draft: null, error: '' }) }}><p className="access-muted">A pessoa recebe um código para criar a própria senha.</p><form className="access-form" onSubmit={submit} aria-busy={Boolean(state.pending)}><label>Nome<input name="displayName" required disabled={blocked} placeholder="Ex.: Ana Souza" value={draft.displayName} onChange={event => setDraft({ ...draft, displayName: event.target.value })} /></label><label>Usuário de acesso<input name="identifier" required autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={blocked} placeholder="Ex.: ana.atendimento" value={draft.identifier} onChange={event => setDraft({ ...draft, identifier: event.target.value })} /><small>É o identificador que a pessoa usará para entrar. Escolha um nome único, como ana.atendimento.</small></label><AccessSelectField label="Perfil" options={roleOptions} value={draft.roleId || defaultRole} disabled={Boolean(blocked)} onChange={roleId => setDraft({ ...draft, roleId })} /><p className="access-callout"><Icon name="shield" size={18} />{managerRole(draft.roleId || defaultRole) ? 'Gerente: acesso à operação, gestão e administração da equipe.' : 'Operador: atendimento, pedidos, comandas e impressão. Sem gestão da equipe ou finanças.'}</p>{state.error && <p className="access-feedback access-feedback-error" role="alert">{state.error}</p>}<Button type="submit" disabled={blocked || !state.data}>{state.pending ? 'Criando…' : 'Criar convite'}</Button></form></Modal>}
    {canManage && editing && <Modal title="Editar conta" className="access-dialog" onClose={() => { if (!state.pending) setEditing(null) }}><div className="access-form"><label>Nome<input disabled={blocked} value={editing.displayName} onChange={event => setEditing({ ...editing, displayName: event.target.value })} /></label><AccessSelectField label="Perfil" options={roleOptions} value={editing.roleId} disabled={Boolean(blocked || isLastManager(data.users.find(user => user.id === editing.id) || editing))} onChange={roleId => setEditing({ ...editing, roleId })} />{isLastManager(data.users.find(user => user.id === editing.id) || editing) && <p className="access-callout">Este é o último gerente com acesso ativo. Ative outro gerente antes de mudar seu perfil.</p>}<Button disabled={blocked || !editing.displayName.trim()} onClick={async () => { const current = data.users.find(user => user.id === editing.id); if (current && isLastManager(current) && !managerRole(editing.roleId)) return; const result = await mutate(() => api.updateUser(editing.id, { displayName: editing.displayName, roleId: editing.roleId })); if (result && owns()) setEditing(null) }}>Salvar conta</Button>{state.error && <p role="alert">{state.error}</p>}</div></Modal>}
    {canManage && state.confirmation && <Modal title={state.confirmation.kind === 'reset' ? 'Redefinir acesso' : state.confirmation.user.active ? 'Desativar conta' : 'Reativar conta'} className="access-dialog" onClose={() => { if (!state.pending) patch({ confirmation: null, error: '' }) }}><p><strong>{state.confirmation.user.displayName}</strong></p><p className="access-muted">{state.confirmation.kind === 'reset' ? 'As sessões desta pessoa serão encerradas. Você receberá um novo convite para ela criar outra senha.' : state.confirmation.user.active ? 'Esta pessoa perderá acesso à operação e suas sessões serão encerradas.' : 'A conta será reativada. A pessoa poderá entrar se já tiver uma senha ativa.'}</p>{state.error && <p role="alert">{state.error}</p>}<div className="access-actions"><Button variant="secondary" disabled={blocked} onClick={() => patch({ confirmation: null, error: '' })}>Cancelar</Button><Button disabled={blocked} onClick={confirmMutation}>{state.confirmation.kind === 'reset' ? 'Confirmar redefinição' : state.confirmation.user.active ? 'Confirmar desativação' : 'Confirmar reativação'}</Button></div></Modal>}
    {state.invite && <Modal title="Convite criado" className="access-dialog" onClose={() => patch({ invite: null, inviteUser: null, copied: false, copyError: '' })}><p className="access-callout"><Icon name="check" size={18} />Convite de uso único. Copie o código agora; ele não poderá ser exibido novamente.</p><p className="access-muted">Usuário de acesso</p><strong>{state.inviteUser?.identifier}</strong><p className="access-muted">Código de ativação</p><pre className="access-token">{state.invite.token}</pre><Button variant="secondary" onClick={copyInvite}>{state.copied ? 'Código copiado' : 'Copiar código'}</Button>{state.copyError && <p role="status">{state.copyError}</p>}<ol className="access-invite-steps"><li>Abra <a href="/ativar-conta" target="_blank" rel="noreferrer">a tela de ativação</a> e cole o código.</li><li>Crie e confirme a senha.</li><li>Entre com o usuário <strong>{state.inviteUser?.identifier}</strong> e a senha criada.</li></ol><p className="access-muted">Validade: {new Date(state.invite.expiresAt).toLocaleString('pt-BR')}</p><Button onClick={() => patch({ invite: null, inviteUser: null, copied: false, copyError: '' })}>Fechar convite</Button></Modal>}
  </div>
}
