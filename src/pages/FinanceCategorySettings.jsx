import { useState } from 'react'
import Button from '../components/Button.jsx'
import ConfirmationDialog from '../components/ConfirmationDialog.jsx'
import SettingsEditorShell from '../components/SettingsEditorShell.jsx'
import SettingsItemDialog from '../components/SettingsItemDialog.jsx'
import SettingsItemList from '../components/SettingsItemList.jsx'

const blockedStatuses = new Set(['loading', 'saving', 'unconfirmed', 'conflict'])
const TYPES = [
  { id: 'entrada', title: 'Entradas manuais', headingId: 'manual-in-title' },
  { id: 'saida', title: 'Saídas manuais', headingId: 'manual-out-title' },
]
const cleanName = (value) => String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .trim().replace(/\s+/gu, ' ').toLocaleLowerCase('pt-BR')

function orderedItems(data) {
  return TYPES.flatMap(({ id: type }) => [...(data?.items || [])].filter((item) => item.type === type)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((item, sortOrder) => ({ ...item, sortOrder })))
}

function FinanceCategorySettings({ resourceState, readOnly = false, onEdit, onSave, onDiscard, onReconcile, onReload, onReviewConflict }) {
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
    onEdit?.({ items: orderedItems({ items: nextItems }) })
    return true
  }
  const duplicateError = (label, type, exceptId = null) => items.some((item) => item.id !== exceptId
    && item.type === type && cleanName(item.label) === cleanName(label)) ? 'Já existe uma categoria com esse nome.' : ''
  const add = ({ label, type }) => {
    const error = duplicateError(label, type)
    if (error) return error
    const typed = items.filter((item) => item.type === type)
    editItems([...items, { id: crypto.randomUUID(), type, label, active: true, sortOrder: typed.length }])
    return true
  }
  const rename = ({ label }) => {
    const current = dialog?.item
    if (!current) return false
    const error = duplicateError(label, current.type, current.id)
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
      setPendingDelete(item); return true
    }
    if (actionId === 'activate' || actionId === 'deactivate') {
      return editItems(items.map((candidate) => candidate.id === item.id ? { ...candidate, active: actionId === 'activate' } : candidate))
    }
    const typed = items.filter((candidate) => candidate.type === item.type)
    const index = typed.findIndex((candidate) => candidate.id === item.id)
    const target = index + (actionId === 'up' ? -1 : actionId === 'down' ? 1 : 0)
    if (index < 0 || target < 0 || target >= typed.length || target === index) return false
    ;[typed[index], typed[target]] = [typed[target], typed[index]]
    return editItems([...items.filter((candidate) => candidate.type !== item.type), ...typed])
  }

  const itemView = (item, index, typed) => {
    const base = baseById.get(item.id)
    const isNew = !base
    const permissions = meta[item.id] || (isNew
      ? { isSystem: false, usedEver: false, canRename: true, canDelete: true }
      : { isSystem: false, usedEver: false, canRename: false, canDelete: false })
    const pending = !isNew && JSON.stringify(base) !== JSON.stringify(item)
    return {
      ...item,
      dataAttributes: { 'data-finance-category-id': item.id, 'data-finance-category-type': item.type },
      label: <span className="settings-catalog-copy"><span>{item.label}</span><span className="settings-catalog-badges">
        <span className="settings-catalog-badge">{permissions.isSystem ? 'Nativa' : 'Personalizada'}</span>
        <span className={item.active ? 'settings-catalog-badge is-active' : 'settings-catalog-badge'}>{item.active ? 'Ativa' : 'Inativa'}</span>
        {permissions.usedEver && <span className="settings-catalog-badge">Já utilizada</span>}
        {isNew && <span className="settings-catalog-badge is-pending">Nova</span>}
        {pending && <span className="settings-catalog-badge is-pending">Alteração pendente</span>}
      </span></span>,
      actions: readOnly ? [] : [
        { id: item.active ? 'deactivate' : 'activate', label: item.active ? 'Desativar' : 'Ativar', disabledReason: lockedReason },
        ...(permissions.canRename ? [{ id: 'rename', label: 'Renomear', disabledReason: lockedReason }] : []),
        ...(permissions.canDelete ? [{ id: 'delete', label: 'Excluir', disabledReason: lockedReason }] : []),
        { id: 'up', label: 'Mover para cima', disabledReason: lockedReason || (index === 0 ? 'Esta categoria já é a primeira deste grupo.' : '') },
        { id: 'down', label: 'Mover para baixo', disabledReason: lockedReason || (index === typed.length - 1 ? 'Esta categoria já é a última deste grupo.' : '') },
      ],
    }
  }

  return <SettingsEditorShell title="Categorias financeiras" description="Gerencie categorias disponíveis para novos lançamentos manuais." scope="Todo o negócio" effectiveNotice="Vendas e estornos são categorias automáticas protegidas. Alterações abaixo valem somente para novos lançamentos manuais." state={resourceState} readOnly={readOnly} onSave={onSave} onDiscard={onDiscard} onReconcile={onReconcile} onReload={onReload} onReviewConflict={onReviewConflict}>
    <div className="finance-category-settings">
      {!readOnly && <div className="settings-catalog-toolbar"><Button type="button" icon="plus" disabled={locked} onClick={() => setDialog({ mode: 'add' })}>Adicionar categoria</Button></div>}
      {!data ? <p className="settings-empty-state">As categorias confirmadas aparecerão quando esta configuração estiver disponível.</p> : TYPES.map((group) => {
        const typed = items.filter((item) => item.type === group.id)
        return <section className={`finance-category-group is-${group.id}`} aria-labelledby={group.headingId} key={group.id}>
          <div className="section-heading compact-section-heading"><h2 id={group.headingId}>{group.title}</h2><span className="toolbar-count">{typed.length}</span></div>
          {typed.length ? <SettingsItemList label={group.title} items={typed.map((item, index) => itemView(item, index, typed))} getActions={(item) => item.actions} onAction={action} /> : <p className="settings-empty-state">Nenhuma categoria cadastrada neste grupo.</p>}
        </section>
      })}
    </div>
    <SettingsItemDialog open={Boolean(dialog)} kind="finance" mode={dialog?.mode} initialValue={dialog?.item ? { label: dialog.item.label, type: dialog.item.type } : { label: '', type: 'entrada' }} onAdd={dialog?.mode === 'edit' ? rename : add} onClose={() => setDialog(null)} />
    {pendingDelete && <ConfirmationDialog title="Excluir categoria?" message={`A categoria “${pendingDelete.label}” será removida do rascunho e só será excluída ao salvar as alterações.`} confirmLabel="Excluir do rascunho" onConfirm={() => { remove(pendingDelete.id); setPendingDelete(null) }} onClose={() => setPendingDelete(null)} />}
  </SettingsEditorShell>
}

export default FinanceCategorySettings
