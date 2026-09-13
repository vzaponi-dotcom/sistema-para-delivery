import { useState } from 'react'
import Button from '../components/Button.jsx'
import ConfirmationDialog from '../components/ConfirmationDialog.jsx'
import SettingsEditorShell from '../components/SettingsEditorShell.jsx'
import SettingsItemDialog from '../components/SettingsItemDialog.jsx'
import SettingsItemList from '../components/SettingsItemList.jsx'

const blockedStatuses = new Set(['loading', 'saving', 'unconfirmed', 'conflict'])
const normalizeName = (value) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .trim().replace(/\s+/gu, ' ').toLocaleLowerCase('pt-BR')

const orderedItems = (data) => [...(data?.items || [])]
  .sort((left, right) => left.sortOrder - right.sortOrder)
  .map((item, sortOrder) => ({ ...item, sortOrder }))

function CancellationSettings({
  resourceState,
  readOnly = false,
  onEdit,
  onSave,
  onDiscard,
  onReconcile,
  onReload,
  onReviewConflict,
}) {
  const [dialog, setDialog] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const data = resourceState?.draft || resourceState?.confirmed?.data || null
  const items = orderedItems(data)
  const baseItems = resourceState?.base?.data?.items || resourceState?.confirmed?.data?.items || []
  const baseById = new Map(baseItems.map((item) => [item.id, item]))
  const meta = resourceState?.confirmed?.meta?.items || resourceState?.base?.meta?.items || {}
  const locked = readOnly || !data || blockedStatuses.has(resourceState?.status)
  const lockedReason = locked ? 'A configuração está temporariamente bloqueada.' : ''

  const editItems = (nextItems) => {
    if (locked) return false
    onEdit?.({ items: nextItems.map((item, sortOrder) => ({ ...item, sortOrder })) })
    return true
  }

  const duplicateError = (label, exceptId = null) => items.some((item) => item.id !== exceptId
    && normalizeName(item.label) === normalizeName(label)) ? 'Já existe um motivo com esse nome.' : ''

  const add = (value) => {
    const label = typeof value === 'string' ? value : value.label
    const active = typeof value === 'object' ? value.active !== false : true
    const error = duplicateError(label)
    if (error) return error
    const id = crypto.randomUUID()
    editItems([...items, { id, label, active, sortOrder: items.length }])
    return true
  }

  const rename = (value) => {
    const current = dialog?.item
    if (!current) return false
    const label = typeof value === 'string' ? value : value.label
    const error = duplicateError(label, current.id)
    if (error) return error
    editItems(items.map((item) => item.id === current.id ? { ...item, label } : item))
    return true
  }

  const remove = (id) => editItems(items.filter((item) => item.id !== id))

  const action = (item, actionId) => {
    if (locked) return false
    if (actionId === 'rename') { setDialog({ mode: 'edit', item }); return true }
    if (actionId === 'delete') {
      if (!baseById.has(item.id)) return remove(item.id)
      setPendingDelete(item)
      return true
    }
    if (actionId === 'activate' || actionId === 'deactivate') {
      if (item.id === 'other' && actionId === 'deactivate') return false
      return editItems(items.map((candidate) => candidate.id === item.id
        ? { ...candidate, active: actionId === 'activate' } : candidate))
    }
    const index = items.findIndex((candidate) => candidate.id === item.id)
    const target = index + (actionId === 'up' ? -1 : actionId === 'down' ? 1 : 0)
    if (index < 0 || target < 0 || target >= items.length || target === index) return false
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    return editItems(next)
  }

  const viewItems = items.map((item, index) => {
    const permissions = meta[item.id] || { isSystem: false, usedEver: false, canRename: true, canDelete: true, requiresNote: false }
    const base = baseById.get(item.id)
    const isNew = !base
    const pending = !isNew && JSON.stringify(base) !== JSON.stringify(item)
    const actions = readOnly ? [] : [
      {
        id: item.active ? 'deactivate' : 'activate', label: item.active ? 'Desativar' : 'Ativar',
        disabledReason: lockedReason || (item.id === 'other' && item.active ? 'Outro deve permanecer ativo.' : ''),
      },
      ...(permissions.canRename ? [{ id: 'rename', label: 'Renomear', disabledReason: lockedReason }] : []),
      ...(permissions.canDelete ? [{ id: 'delete', label: 'Excluir', disabledReason: lockedReason }] : []),
      { id: 'up', label: 'Mover para cima', disabledReason: lockedReason || (index === 0 ? 'Este motivo já é o primeiro.' : '') },
      { id: 'down', label: 'Mover para baixo', disabledReason: lockedReason || (index === items.length - 1 ? 'Este motivo já é o último.' : '') },
    ]
    return {
      ...item,
      dataAttributes: { 'data-cancellation-id': item.id },
      label: <span className="settings-catalog-copy">
        <span>{item.label}</span>
        <span className="settings-catalog-badges">
          <span className="settings-catalog-badge">{permissions.isSystem ? 'Nativo' : 'Personalizado'}</span>
          <span className={item.active ? 'settings-catalog-badge is-active' : 'settings-catalog-badge'}>{item.active ? 'Ativo' : 'Inativo'}</span>
          {permissions.requiresNote && <span className="settings-catalog-badge is-note">Exige nota</span>}
          {permissions.usedEver && <span className="settings-catalog-badge">Já utilizado</span>}
          {isNew && <span className="settings-catalog-badge is-pending">Novo</span>}
          {pending && <span className="settings-catalog-badge is-pending">Alteração pendente</span>}
        </span>
      </span>,
      actions,
    }
  })

  return <SettingsEditorShell
    title="Motivos de cancelamento"
    description="Gerencie os motivos oferecidos ao cancelar novos pedidos."
    scope="Todo o negócio"
    effectiveNotice="As mudanças valem para novos cancelamentos. Pedidos cancelados preservam o motivo histórico."
    state={resourceState}
    readOnly={readOnly}
    onSave={onSave}
    onDiscard={onDiscard}
    onReconcile={onReconcile}
    onReload={onReload}
    onReviewConflict={onReviewConflict}
  >
    <div className="cancellation-settings">
      {!readOnly && <div className="settings-catalog-toolbar"><Button type="button" icon="plus" disabled={locked} onClick={() => setDialog({ mode: 'add' })}>Adicionar motivo</Button></div>}
      {!data
        ? <p className="settings-empty-state">Os motivos confirmados aparecerão quando esta configuração estiver disponível.</p>
        : <SettingsItemList label="Motivos de cancelamento" items={viewItems} getActions={(item) => item.actions} onAction={action} />}
    </div>
    <SettingsItemDialog
      open={Boolean(dialog)}
      kind="cancellation"
      mode={dialog?.mode}
      initialValue={dialog?.item ? { label: dialog.item.label, active: dialog.item.active } : { label: '', active: true }}
      onAdd={dialog?.mode === 'edit' ? rename : add}
      onClose={() => setDialog(null)}
    />
    {pendingDelete && <ConfirmationDialog
      title="Excluir motivo?"
      message={`O motivo “${pendingDelete.label}” será removido do rascunho e só será excluído ao salvar as alterações.`}
      confirmLabel="Excluir do rascunho"
      onConfirm={() => { remove(pendingDelete.id); setPendingDelete(null) }}
      onClose={() => setPendingDelete(null)}
    />}
  </SettingsEditorShell>
}

export default CancellationSettings
