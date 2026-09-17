import { DragDropProvider, DragOverlay, useDragOperation } from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import SettingsEditorShell from './components/SettingsEditorShell.jsx'
import { SettingsBackLink, SettingsSwitch } from './components/SettingsBackAndSwitchControls.jsx'
import { paymentLabel } from '../../../../shared/businessPolicies.js'
import { reorderPaymentMethods } from './paymentSettingsModel.js'
import pixSymbolUrl from '../../../assets/pix-symbol.svg'
import '../../../payment-settings.css'

export { reorderPaymentMethods } from './paymentSettingsModel.js'

const blockedStatuses = new Set(['loading', 'saving', 'unconfirmed', 'conflict'])
const descriptions = {
  pix: 'Pagamento instantâneo',
  cash: 'Pagamento na entrega',
  debit_card: 'Visa, Mastercard, Elo e outros',
  credit_card: 'Visa, Mastercard, Elo e outros',
  transfer: 'TED, DOC ou transferência bancária',
  other: 'Outros métodos de pagamento',
}

const normalizedMethods = (data) => [...(data?.methods || [])]
  .sort((left, right) => left.sortOrder - right.sortOrder)
  .map((method, sortOrder) => ({ ...method, sortOrder }))

function PaymentIcon({ code }) {
  if (code === 'pix') return <span data-payment-icon="pix" className="payment-icon-pix" aria-hidden="true" style={{ '--payment-pix-mask': `url("${pixSymbolUrl}")` }} />
  if (code === 'cash') return <svg data-payment-icon="cash" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6.5 9.5h.01M17.5 14.5h.01"/></svg>
  if (code === 'debit_card' || code === 'credit_card') return <svg data-payment-icon="card" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></svg>
  if (code === 'transfer') return <svg data-payment-icon="transfer" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10 12 4l9 6M5 10v9h14v-9M3 20h18M8 13v3M12 13v3M16 13v3"/></svg>
  return <svg data-payment-icon="other" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle className="payment-icon-dot" cx="8" cy="12" r=".8"/><circle className="payment-icon-dot" cx="12" cy="12" r=".8"/><circle className="payment-icon-dot" cx="16" cy="12" r=".8"/></svg>
}

function PaymentDragPreview({ method, isDefault }) {
  if (!method) return null
  return <div className="payment-drag-overlay-card" data-payment-drag-overlay={method.code}>
    <span className="payment-drag-overlay-grip" aria-hidden="true">⠿</span>
    <span className="payment-method-icon"><PaymentIcon code={method.code} /></span>
    <span className="payment-drag-overlay-copy"><strong>{paymentLabel(method.code)}</strong><small>{descriptions[method.code]}</small></span>
    {isDefault && <span className="payment-default-badge">★ <span>Padrão</span></span>}
  </div>
}

function PaymentSortableRow({ method, index, data, activeCount, locked, readOnly, lockedReason, onMove, onAction }) {
  const {
    ref: sortableRef,
    handleRef,
    isDropTarget,
    isDragSource,
    isDropping,
  } = useSortable({
    id: method.code,
    index,
    disabled: locked,
    transition: { duration: 160, easing: 'cubic-bezier(.2,.8,.2,1)', idle: true },
  })
  const { source } = useDragOperation()
  const liveSortable = source && isSortable(source) ? source : null
  const showMarker = liveSortable && liveSortable.initialIndex !== liveSortable.index && liveSortable.index === index
  const markerPosition = showMarker && liveSortable.initialIndex < liveSortable.index ? 'after' : 'before'
  const isDefault = method.code === data.defaultMethod
  const disabledReason = method.active && (isDefault || activeCount <= 1)
    ? isDefault
      ? 'Defina outro método ativo como padrão antes de desativar este.'
      : 'Mantenha pelo menos uma forma de pagamento ativa.'
    : ''
  const className = [
    'payment-settings-row',
    !method.active ? 'is-inactive' : '',
    isDragSource ? 'is-dnd-source' : '',
    isDropTarget ? 'is-dnd-target' : '',
    isDropping ? 'is-dnd-dropping' : '',
  ].filter(Boolean).join(' ')

  const runMenuAction = (event, actionId) => {
    const applied = onAction(method, actionId)
    if (!applied) return
    const details = event?.currentTarget?.closest?.('details')
    const summary = details?.querySelector?.('summary')
    if (details) details.open = false
    summary?.focus?.()
  }

  return <article
    ref={sortableRef}
    role="row"
    data-payment-code={method.code}
    data-payment-sortable-id={method.code}
    className={className}
    onKeyDown={locked ? undefined : (event) => {
      if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return
      event.preventDefault()
      onMove(method.code, event.key === 'ArrowUp' ? -1 : 1)
    }}
  >
    {showMarker && <span className={`payment-insertion-marker is-${markerPosition}`} data-payment-insertion-marker={String(index)} aria-hidden="true" />}
    <div className="payment-order-cell" role="cell">
      <button
        ref={handleRef}
        type="button"
        className="payment-drag-handle"
        data-payment-drag-handle={method.code}
        aria-label={`Reordenar ${paymentLabel(method.code)}`}
        disabled={locked}
      ><span aria-hidden="true">⠿</span></button>
      <span>{index + 1}</span>
    </div>
    <div className="payment-method-cell" role="cell">
      <span className="payment-method-icon"><PaymentIcon code={method.code} /></span>
      <span><strong>{paymentLabel(method.code)}</strong><small>{descriptions[method.code]}</small></span>
    </div>
    <div className="payment-meta-cell" role="cell">
      <div className="payment-meta-badges">
        {isDefault && <span className="payment-default-badge">★ <span>Padrão</span></span>}
      </div>
      <SettingsSwitch
        className="payment-meta-switch"
        id={method.code}
        checked={method.active}
        disabled={locked || Boolean(disabledReason)}
        title={lockedReason || disabledReason || undefined}
        label={`${method.active ? 'Desativar' : 'Ativar'} ${paymentLabel(method.code)}`}
        onChange={(active) => onAction(method, active ? 'activate' : 'deactivate')}
      />
    </div>
    <div className="payment-actions-cell" role="cell" data-payment-actions={method.code}>
      {!readOnly && <details className="payment-actions-menu" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false }}>
        <summary aria-label={`Ações de ${paymentLabel(method.code)}`}>···</summary>
        <div>
          {method.active && !isDefault && <button type="button" disabled={Boolean(lockedReason)} onClick={(event) => runMenuAction(event, 'default')}>Definir como padrão</button>}
          <button type="button" disabled={Boolean(lockedReason) || index === 0} onClick={(event) => runMenuAction(event, 'up')}>Mover para cima</button>
          <button type="button" disabled={Boolean(lockedReason) || index === data.methods.length - 1} onClick={(event) => runMenuAction(event, 'down')}>Mover para baixo</button>
        </div>
      </details>}
    </div>
  </article>
}

function PaymentSettings({ resourceState, readOnly = false, onEdit, onSave, onDiscard, onReconcile, onReload, onReviewConflict, onNavigateHome }) {
  const data = resourceState?.draft || resourceState?.confirmed?.data || null
  const methods = normalizedMethods(data)
  const activeCount = methods.filter((method) => method.active).length
  const locked = readOnly || !data || blockedStatuses.has(resourceState?.status)
  const lockedReason = locked ? 'A configuração está temporariamente bloqueada.' : ''

  const editMethods = (nextMethods, patch = {}) => {
    if (locked) return false
    onEdit?.({ ...data, ...patch, methods: nextMethods.map((method, sortOrder) => ({ ...method, sortOrder })) })
    return true
  }

  const move = (code, direction) => {
    const sourceIndex = methods.findIndex((method) => method.code === code)
    const targetIndex = sourceIndex + direction
    return sourceIndex < 0 || targetIndex < 0 || targetIndex >= methods.length
      ? false
      : editMethods(reorderPaymentMethods(methods, sourceIndex, targetIndex))
  }

  const action = (method, actionId) => {
    if (locked) return false
    if (actionId === 'up') return move(method.code, -1)
    if (actionId === 'down') return move(method.code, 1)
    if (actionId === 'default') return method.active ? editMethods(methods, { defaultMethod: method.code }) : false
    if (actionId === 'activate') return editMethods(methods.map((candidate) => candidate.code === method.code ? { ...candidate, active: true } : candidate))
    if (actionId === 'deactivate' && method.active && method.code !== data.defaultMethod && activeCount > 1) return editMethods(methods.map((candidate) => candidate.code === method.code ? { ...candidate, active: false } : candidate))
    return false
  }

  const handleDragEnd = (event) => {
    if (event.canceled) return
    const { source } = event.operation
    if (!source || !isSortable(source)) return
    const { initialIndex, index } = source
    if (initialIndex === index) return
    editMethods(reorderPaymentMethods(methods, initialIndex, index))
  }

  return <SettingsEditorShell
    className="payment-editor"
    title="Formas de pagamento"
    description="Gerencie os métodos de pagamento aceitos no seu delivery"
    scope={<SettingsBackLink onClick={onNavigateHome} />}
    discardLabel="Cancelar"
    footerNote="Gestão Delivery · v1.0.0"
    effectiveNotice={<><span className="payment-info-icon" aria-hidden="true">i</span><span>Os métodos nativos não podem ser renomeados.<small className="payment-notice-secondary">As alterações realizadas serão aplicadas após salvar.</small></span></>}
    state={resourceState}
    readOnly={readOnly}
    onSave={onSave}
    onDiscard={onDiscard}
    onReconcile={onReconcile}
    onReload={onReload}
    onReviewConflict={onReviewConflict}
  >
    {!data ? <p className="settings-empty-state">Os métodos confirmados aparecerão quando esta configuração estiver disponível.</p> : <DragDropProvider onDragEnd={handleDragEnd}>
      <section className="payment-settings-table" role="table" aria-label="Formas de pagamento">
        <div className="payment-settings-table-head" role="row"><span>ORDEM</span><span>FORMA</span><span>STATUS</span><span>PADRÃO</span><span>AÇÕES</span></div>
        <div className="payment-settings-table-body" role="rowgroup">
          {methods.map((method, index) => <PaymentSortableRow
            key={method.code}
            method={method}
            index={index}
            data={data}
            activeCount={activeCount}
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
          const method = methods.find((candidate) => candidate.code === source?.id)
          return method ? <PaymentDragPreview method={method} isDefault={method.code === data.defaultMethod} /> : null
        }}
      </DragOverlay>
    </DragDropProvider>}
  </SettingsEditorShell>
}

export default PaymentSettings
