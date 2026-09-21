import { useState } from 'react'
import { DragDropProvider, DragOverlay, useDragOperation } from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import Button from '../../../../shared/ui/Button.jsx'
import ConfirmationDialog from '../../../../shared/ui/ConfirmationDialog.jsx'
import Icon from '../../../../shared/ui/Icon.jsx'
import SettingsEditorShell from '../../../../app/surfaces/settings/components/SettingsEditorShell.jsx'
import SettingsItemDialog from '../../../../app/surfaces/settings/components/SettingsItemDialog.jsx'
import { SettingsBackLink, SettingsSwitch } from '../../../../app/surfaces/settings/components/SettingsBackAndSwitchControls.jsx'
import '../../../../finance-category-settings.css'

const blockedStatuses = new Set(['loading', 'saving', 'unconfirmed', 'conflict'])
const TYPES = [
  {
    id: 'entrada',
    title: 'Entradas manuais',
    headingId: 'manual-in-title',
    description: 'Categorias de receitas que você lança manualmente (além das vendas do sistema).',
    icon: 'arrow-up',
  },
  {
    id: 'saida',
    title: 'Saídas manuais',
    headingId: 'manual-out-title',
    description: 'Categorias de despesas que você lança manualmente.',
    icon: 'arrow-down',
  },
]
const CATEGORY_ICONS = {
  contribution: 'wallet',
  other_income: 'receipt',
  supplies: 'products',
  packaging: 'package',
  delivery_costs: 'delivery',
  gas: 'flame',
  water: 'droplet',
  electricity: 'bolt',
  rent: 'home',
  maintenance: 'wrench',
  fees: 'percent',
  owner_draw: 'client',
  other_expense: 'details',
}

const cleanName = (value) => String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .trim().replace(/\s+/gu, ' ').toLocaleLowerCase('pt-BR')

function orderedItems(data) {
  return TYPES.flatMap(({ id: type }) => [...(data?.items || [])].filter((item) => item.type === type)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((item, sortOrder) => ({ ...item, sortOrder })))
}

function normalizeEditedItems(items) {
  return TYPES.flatMap(({ id: type }) => items.filter((item) => item.type === type)
    .map((item, sortOrder) => ({ ...item, sortOrder })))
}

const reorderItems = (items, fromIndex, toIndex) => {
  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

const typeLabel = (type) => type === 'entrada' ? 'Receita' : 'Despesa'
const categoryIcon = (item) => CATEGORY_ICONS[item.id] || (item.type === 'entrada' ? 'wallet' : 'receipt')

function FinanceCategoryDragPreview({ item }) {
  if (!item) return null
  return <div className={`finance-category-drag-overlay-card is-${item.type}`} data-finance-category-drag-overlay={item.id}>
    <span className="finance-category-item-icon"><Icon name={categoryIcon(item)} size={18} /></span>
    <strong>{item.label}</strong>
    <span className={`finance-category-type-badge ${item.type === 'entrada' ? 'is-income' : 'is-expense'}`}>{typeLabel(item.type)}</span>
  </div>
}

function FinanceCategorySortableRow({
  item,
  permissions,
  index,
  itemCount,
  locked,
  readOnly,
  lockedReason,
  onMove,
  onAction,
}) {
  const {
    ref: sortableRef,
    handleRef,
    isDropTarget,
    isDragSource,
    isDropping,
  } = useSortable({
    id: item.id,
    index,
    disabled: locked,
    transition: { duration: 160, easing: 'cubic-bezier(.2,.8,.2,1)', idle: true },
  })
  const { source } = useDragOperation()
  const liveSortable = source && isSortable(source) ? source : null
  const showMarker = liveSortable && liveSortable.initialIndex !== liveSortable.index && liveSortable.index === index
  const markerPosition = showMarker && liveSortable.initialIndex < liveSortable.index ? 'after' : 'before'
  const className = [
    'finance-category-settings-row',
    !item.active ? 'is-inactive' : '',
    isDragSource ? 'is-dnd-source' : '',
    isDropTarget ? 'is-dnd-target' : '',
    isDropping ? 'is-dnd-dropping' : '',
  ].filter(Boolean).join(' ')

  const runMenuAction = (event, actionId) => {
    const applied = onAction(item, actionId)
    if (!applied) return
    const details = event?.currentTarget?.closest?.('details')
    const summary = details?.querySelector?.('summary')
    if (details) details.open = false
    summary?.focus?.()
  }

  return <article
    ref={sortableRef}
    role="row"
    data-finance-category-id={item.id}
    data-finance-category-type={item.type}
    className={className}
    onKeyDown={locked ? undefined : (event) => {
      if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return
      event.preventDefault()
      onMove(item.id, event.key === 'ArrowUp' ? -1 : 1)
    }}
  >
    {showMarker && <span className={`finance-category-insertion-marker is-${markerPosition}`} aria-hidden="true" />}
    <div className="finance-category-order-cell" role="cell">
      <button
        ref={handleRef}
        type="button"
        className="finance-category-drag-handle"
        data-finance-category-drag-handle={item.id}
        aria-label={`Reordenar ${item.label}`}
        disabled={locked}
      ><span aria-hidden="true">⠿</span></button>
      <span className="finance-category-visually-hidden">{index + 1}</span>
    </div>
    <div className="finance-category-name-cell" role="cell">
      <span className="finance-category-item-icon" data-finance-category-icon={item.id}>
        <Icon name={categoryIcon(item)} size={18} />
      </span>
      <strong>{item.label}</strong>
    </div>
    <div className="finance-category-meta" data-finance-category-meta={item.id}>
      <span className={`finance-category-type-badge ${item.type === 'entrada' ? 'is-income' : 'is-expense'}`} role="cell">{typeLabel(item.type)}</span>
      <SettingsSwitch
        className="finance-category-meta-switch"
        id={item.id}
        checked={item.active}
        disabled={locked}
        title={lockedReason || undefined}
        label={`${item.active ? 'Desativar' : 'Ativar'} ${item.label}`}
        onChange={(active) => onAction(item, active ? 'activate' : 'deactivate')}
      />
    </div>
    <div className="finance-category-actions-cell" role="cell" data-finance-category-actions={item.id}>
      {!readOnly && <details className="finance-category-actions-menu" onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false
      }}>
        <summary aria-label={`Ações de ${item.label}`}>···</summary>
        <div>
          {permissions.canRename && <button type="button" disabled={Boolean(lockedReason)} onClick={(event) => runMenuAction(event, 'rename')}>Renomear</button>}
          <button type="button" disabled={Boolean(lockedReason) || index === 0} onClick={(event) => runMenuAction(event, 'up')}>Mover para cima</button>
          <button type="button" disabled={Boolean(lockedReason) || index === itemCount - 1} onClick={(event) => runMenuAction(event, 'down')}>Mover para baixo</button>
          {permissions.canDelete && <button type="button" className="is-danger" disabled={Boolean(lockedReason)} onClick={(event) => runMenuAction(event, 'delete')}>Excluir</button>}
        </div>
      </details>}
    </div>
  </article>
}

function FinanceCategorySettings({
  resourceState,
  readOnly = false,
  onEdit,
  onSave,
  onDiscard,
  onReconcile,
  onReload,
  onReviewConflict,
  onNavigateHome,
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
    onEdit?.({ items: normalizeEditedItems(nextItems) })
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

  const permissionFor = (item) => {
    const isNew = !baseById.has(item.id)
    return meta[item.id] || (isNew
      ? { isSystem: false, usedEver: false, canRename: true, canDelete: true, type: item.type }
      : { isSystem: false, usedEver: false, canRename: false, canDelete: false, type: item.type })
  }

  const move = (id, direction) => {
    const item = items.find((candidate) => candidate.id === id)
    if (!item) return false
    const typed = items.filter((candidate) => candidate.type === item.type)
    const sourceIndex = typed.findIndex((candidate) => candidate.id === item.id)
    const targetIndex = sourceIndex + direction
    if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= typed.length) return false
    const reordered = reorderItems(typed, sourceIndex, targetIndex)
    return editItems([...items.filter((candidate) => candidate.type !== item.type), ...reordered])
  }

  const action = (item, actionId) => {
    if (locked) return false
    if (actionId === 'rename') { setDialog({ mode: 'edit', item }); return true }
    if (actionId === 'delete') {
      if (!baseById.has(item.id)) return remove(item.id)
      setPendingDelete(item)
      return true
    }
    if (actionId === 'activate' || actionId === 'deactivate') {
      return editItems(items.map((candidate) => candidate.id === item.id
        ? { ...candidate, active: actionId === 'activate' }
        : candidate))
    }
    if (actionId === 'up') return move(item.id, -1)
    if (actionId === 'down') return move(item.id, 1)
    return false
  }

  const handleDragEnd = (type, event) => {
    if (event.canceled) return
    const { source } = event.operation
    if (!source || !isSortable(source)) return
    const { initialIndex, index } = source
    if (initialIndex === index) return
    const typed = items.filter((item) => item.type === type)
    if (initialIndex < 0 || index < 0 || initialIndex >= typed.length || index >= typed.length) return
    const reordered = reorderItems(typed, initialIndex, index)
    editItems([...items.filter((item) => item.type !== type), ...reordered])
  }

  return <SettingsEditorShell
    className="finance-category-editor"
    title="Categorias financeiras"
    description="Organize as categorias manuais de receitas e despesas"
    scope={<SettingsBackLink onClick={onNavigateHome} />}
    discardLabel="Cancelar"
    footerNote="Gestão Delivery · v1.0.0"
    headerAction={!readOnly ? <Button type="button" icon="plus" disabled={locked} onClick={() => setDialog({ mode: 'add' })}>Adicionar categoria</Button> : null}
    effectiveNotice={<>
      <span className="finance-category-info-icon" aria-hidden="true">i</span>
      <span className="finance-category-info-copy">
        <strong>Categorias automáticas são protegidas</strong>
        <small>Categorias automáticas como Vendas e Estornos são gerenciadas pelo sistema e não podem ser editadas. As alterações abaixo valem somente para novos lançamentos manuais.</small>
      </span>
    </>}
    state={resourceState}
    readOnly={readOnly}
    onSave={onSave}
    onDiscard={onDiscard}
    onReconcile={onReconcile}
    onReload={onReload}
    onReviewConflict={onReviewConflict}
  >
    <div className="finance-category-settings">
      {!data
        ? <p className="settings-empty-state">As categorias confirmadas aparecerão quando esta configuração estiver disponível.</p>
        : TYPES.map((group) => {
          const typed = items.filter((item) => item.type === group.id)
          return <section
            className={`finance-category-group is-${group.id}`}
            aria-labelledby={group.headingId}
            data-finance-category-group={group.id}
            key={group.id}
          >
            <div className="finance-category-group-heading">
              <span className="finance-category-group-icon" aria-hidden="true"><Icon name={group.icon} size={20} /></span>
              <div className="finance-category-group-copy">
                <h2 id={group.headingId}>{group.title}</h2>
                <p>{group.description}</p>
              </div>
            </div>
            {typed.length
              ? <DragDropProvider onDragEnd={(event) => handleDragEnd(group.id, event)}>
                <div className="finance-category-table" role="table" aria-label={group.title}>
                  <div className="finance-category-table-head" role="row">
                    <span>ORDEM</span><span>CATEGORIA</span><span>TIPO</span><span>STATUS</span><span>AÇÕES</span>
                  </div>
                  <div className="finance-category-table-body" role="rowgroup">
                    {typed.map((item, index) => <FinanceCategorySortableRow
                      key={item.id}
                      item={item}
                      permissions={permissionFor(item)}
                      index={index}
                      itemCount={typed.length}
                      locked={locked}
                      readOnly={readOnly}
                      lockedReason={lockedReason}
                      onMove={move}
                      onAction={action}
                    />)}
                  </div>
                </div>
                <DragOverlay>
                  {(source) => {
                    const item = typed.find((candidate) => candidate.id === source?.id)
                    return item ? <FinanceCategoryDragPreview item={item} /> : null
                  }}
                </DragOverlay>
              </DragDropProvider>
              : <p className="settings-empty-state">Nenhuma categoria cadastrada neste grupo.</p>}
          </section>
        })}
    </div>
    <SettingsItemDialog
      open={Boolean(dialog)}
      kind="finance"
      mode={dialog?.mode}
      initialValue={dialog?.item ? { label: dialog.item.label, type: dialog.item.type } : { label: '', type: 'entrada' }}
      onAdd={dialog?.mode === 'edit' ? rename : add}
      onClose={() => setDialog(null)}
    />
    {pendingDelete && <ConfirmationDialog
      title="Excluir categoria?"
      message={`A categoria “${pendingDelete.label}” será removida do rascunho e só será excluída ao salvar as alterações.`}
      confirmLabel="Excluir do rascunho"
      onConfirm={() => { remove(pendingDelete.id); setPendingDelete(null) }}
      onClose={() => setPendingDelete(null)}
    />}
  </SettingsEditorShell>
}

export default FinanceCategorySettings
