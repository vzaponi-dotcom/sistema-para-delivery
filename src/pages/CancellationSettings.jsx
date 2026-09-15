import { useState } from 'react'
import { DragDropProvider, DragOverlay, useDragOperation } from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import Button from '../components/Button.jsx'
import ConfirmationDialog from '../components/ConfirmationDialog.jsx'
import Icon from '../components/Icon.jsx'
import SettingsEditorShell from '../components/SettingsEditorShell.jsx'
import SettingsItemDialog from '../components/SettingsItemDialog.jsx'
import { SettingsBackLink, SettingsSwitch } from '../components/SettingsControls.jsx'
import '../cancellation-settings.css'

const blockedStatuses = new Set(['loading', 'saving', 'unconfirmed', 'conflict'])
const normalizeName = (value) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .trim().replace(/\s+/gu, ' ').toLocaleLowerCase('pt-BR')

const orderedItems = (data) => [...(data?.items || [])]
  .sort((left, right) => left.sortOrder - right.sortOrder)
  .map((item, sortOrder) => ({ ...item, sortOrder }))

const reorderItems = (items, fromIndex, toIndex) => {
  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

function CancellationDragPreview({ item, permissions }) {
  if (!item) return null
  return <div className="cancellation-drag-overlay-card" data-cancellation-drag-overlay={item.id}>
    <span className="cancellation-drag-overlay-grip" aria-hidden="true">⠿</span>
    <strong>{item.label}</strong>
    <span className="cancellation-type-badge">{permissions?.isSystem ? 'Nativo' : 'Personalizado'}</span>
  </div>
}

function CancellationSortableRow({
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
  const isOther = item.id === 'other'
  const protectedReason = isOther && item.active ? 'Outro deve permanecer ativo.' : ''
  const className = [
    'cancellation-settings-row',
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
    data-cancellation-id={item.id}
    data-cancellation-sortable-id={item.id}
    className={className}
    onKeyDown={locked ? undefined : (event) => {
      if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return
      event.preventDefault()
      onMove(item.id, event.key === 'ArrowUp' ? -1 : 1)
    }}
  >
    {showMarker && <span className={`cancellation-insertion-marker is-${markerPosition}`} data-cancellation-insertion-marker={String(index)} aria-hidden="true" />}
    <div className="cancellation-order-cell" role="cell">
      <button
        ref={handleRef}
        type="button"
        className="cancellation-drag-handle"
        data-cancellation-drag-handle={item.id}
        aria-label={`Reordenar ${item.label}`}
        disabled={locked}
      ><span aria-hidden="true">⠿</span></button>
      <span className="cancellation-order-number">{index + 1}</span>
    </div>
    <div className="cancellation-reason-cell" role="cell">
      <strong>{item.label}</strong>
      {permissions.requiresNote && <span className="cancellation-note-icon" title="Exige descrição no cancelamento" aria-label="Exige descrição no cancelamento">i</span>}
    </div>
    <div className="cancellation-meta-cell" role="cell">
      <div className="cancellation-meta-badges">
        <span className="cancellation-type-badge">{permissions.isSystem ? 'Nativo' : 'Personalizado'}</span>
        {isOther && <span className="cancellation-protected-badge"><Icon name="shield" size={13} /> Protegido</span>}
      </div>
      <div className="cancellation-status-group">
        <SettingsSwitch
          id={item.id}
          checked={item.active}
          disabled={locked || Boolean(protectedReason)}
          title={lockedReason || protectedReason || undefined}
          label={`${item.active ? 'Desativar' : 'Ativar'} ${item.label}`}
          onChange={(active) => onAction(item, active ? 'activate' : 'deactivate')}
        />
        {permissions.requiresNote && <span className="cancellation-visually-hidden">Exige nota</span>}
      </div>
    </div>
    <div className="cancellation-actions-cell" role="cell" data-cancellation-actions={item.id}>
      {!readOnly && <details className="cancellation-actions-menu" onBlur={(event) => {
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

function CancellationSettings({
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
  const [feedbackMessage, setFeedbackMessage] = useState('')
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
    setFeedbackMessage('')
    editItems([...items, { id, label, active, sortOrder: items.length }])
    return true
  }

  const rename = (value) => {
    const current = dialog?.item
    if (!current) return false
    const label = typeof value === 'string' ? value : value.label
    const error = duplicateError(label, current.id)
    if (error) return error
    setFeedbackMessage('')
    editItems(items.map((item) => item.id === current.id ? { ...item, label } : item))
    return true
  }

  const remove = (id) => editItems(items.filter((item) => item.id !== id))

  const move = (id, direction) => {
    const sourceIndex = items.findIndex((candidate) => candidate.id === id)
    const targetIndex = sourceIndex + direction
    if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= items.length) return false
    setFeedbackMessage('')
    return editItems(reorderItems(items, sourceIndex, targetIndex))
  }

  const action = (item, actionId) => {
    if (locked) return false
    if (actionId === 'rename') { setDialog({ mode: 'edit', item }); return true }
    if (actionId === 'delete') { setPendingDelete(item); return true }
    if (actionId === 'up') return move(item.id, -1)
    if (actionId === 'down') return move(item.id, 1)
    if (actionId === 'activate' || actionId === 'deactivate') {
      if (item.id === 'other' && actionId === 'deactivate') return false
      setFeedbackMessage('')
      return editItems(items.map((candidate) => candidate.id === item.id
        ? { ...candidate, active: actionId === 'activate' } : candidate))
    }
    return false
  }

  const handleDragEnd = (event) => {
    if (event.canceled) return
    const { source } = event.operation
    if (!source || !isSortable(source)) return
    const { initialIndex, index } = source
    if (initialIndex === index) return
    setFeedbackMessage('')
    editItems(reorderItems(items, initialIndex, index))
  }

  const confirmDelete = () => {
    const item = pendingDelete
    if (!item) return
    const removed = remove(item.id)
    if (removed) setFeedbackMessage('Motivo removido. Salve as alterações para confirmar.')
    setPendingDelete(null)
  }

  const permissionFor = (item) => meta[item.id] || {
    isSystem: false,
    usedEver: false,
    canRename: true,
    canDelete: true,
    requiresNote: false,
  }

  return <SettingsEditorShell
    className="cancellation-editor"
    title="Motivos de cancelamento"
    description="Cadastre e organize os motivos disponíveis ao cancelar pedidos."
    scope={<SettingsBackLink onClick={onNavigateHome} />}
    discardLabel="Cancelar"
    footerNote="Gestão Delivery · v1.0.0"
    headerAction={!readOnly ? <Button type="button" icon="plus" disabled={locked} onClick={() => setDialog({ mode: 'add' })}>Adicionar motivo</Button> : null}
    effectiveNotice={<>
      <span className="cancellation-info-icon" aria-hidden="true">i</span>
      <span className="cancellation-info-copy">
        <strong>Motivos utilizados permanecem no histórico</strong>
        <small>Os motivos que já foram usados em cancelamentos não podem ser excluídos, apenas desativados, para manter o histórico dos pedidos. O motivo “Outro” é protegido, permanece sempre ativo e exige uma descrição no momento do cancelamento.</small>
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
    <div className="cancellation-settings">
      {feedbackMessage && <p className="cancellation-feedback" role="status">{feedbackMessage}</p>}
      {!data
        ? <p className="settings-empty-state">Os motivos confirmados aparecerão quando esta configuração estiver disponível.</p>
        : <DragDropProvider onDragEnd={handleDragEnd}>
          <section className="cancellation-settings-table" role="table" aria-label="Motivos de cancelamento">
            <div className="cancellation-settings-table-head" role="row">
              <span>ORDEM</span><span>MOTIVO</span><span>TIPO</span><span>STATUS</span><span>AÇÕES</span>
            </div>
            <div className="cancellation-settings-table-body" role="rowgroup">
              {items.map((item, index) => <CancellationSortableRow
                key={item.id}
                item={item}
                permissions={permissionFor(item)}
                index={index}
                itemCount={items.length}
                locked={locked}
                readOnly={readOnly}
                lockedReason={lockedReason}
                onMove={move}
                onAction={action}
              />)}
            </div>
          </section>
          <DragOverlay>
            {(source) => {
              const item = items.find((candidate) => candidate.id === source?.id)
              return item ? <CancellationDragPreview item={item} permissions={permissionFor(item)} /> : null
            }}
          </DragOverlay>
        </DragDropProvider>}
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
      message={`Tem certeza que deseja excluir “${pendingDelete.label}”? A remoção ficará pendente até você salvar as alterações.`}
      confirmLabel="Excluir do rascunho"
      onConfirm={confirmDelete}
      onClose={() => setPendingDelete(null)}
    />}
  </SettingsEditorShell>
}

export default CancellationSettings
