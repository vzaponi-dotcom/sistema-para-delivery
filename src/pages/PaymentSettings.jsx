import SettingsEditorShell from '../components/SettingsEditorShell.jsx'
import SettingsItemList from '../components/SettingsItemList.jsx'
import { paymentLabel } from '../../shared/businessPolicies.js'

const blockedStatuses = new Set(['loading', 'saving', 'unconfirmed', 'conflict'])

function normalizedMethods(data) {
  return [...(data?.methods || [])]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((method, sortOrder) => ({ ...method, sortOrder }))
}

function PaymentSettings({
  resourceState,
  readOnly = false,
  onEdit,
  onSave,
  onDiscard,
  onReconcile,
  onReload,
  onReviewConflict,
}) {
  const data = resourceState?.draft || resourceState?.confirmed?.data || null
  const methods = normalizedMethods(data)
  const activeCount = methods.filter((method) => method.active).length
  const locked = readOnly || !data || blockedStatuses.has(resourceState?.status)
  const lockedReason = locked ? 'A configuração está temporariamente bloqueada.' : ''

  const editMethods = (nextMethods, patch = {}) => {
    if (locked) return false
    onEdit?.({
      ...data,
      ...patch,
      methods: nextMethods.map((method, sortOrder) => ({ ...method, sortOrder })),
    })
    return true
  }

  const move = (code, direction) => {
    const index = methods.findIndex((method) => method.code === code)
    const target = index + direction
    if (index < 0 || target < 0 || target >= methods.length) return false
    const next = [...methods]
    ;[next[index], next[target]] = [next[target], next[index]]
    return editMethods(next)
  }

  const action = (item, actionId) => {
    const method = methods.find((candidate) => candidate.code === item.code)
    if (!method || locked) return false
    if (actionId === 'up') return move(item.code, -1)
    if (actionId === 'down') return move(item.code, 1)
    if (actionId === 'default') {
      if (!method.active) return false
      return editMethods(methods, { defaultMethod: method.code })
    }
    if (actionId === 'activate') {
      return editMethods(methods.map((candidate) => candidate.code === method.code ? { ...candidate, active: true } : candidate))
    }
    if (actionId === 'deactivate') {
      if (!method.active || method.code === data.defaultMethod || activeCount <= 1) return false
      return editMethods(methods.map((candidate) => candidate.code === method.code ? { ...candidate, active: false } : candidate))
    }
    return false
  }

  const items = methods.map((method, index) => {
    const isDefault = method.code === data?.defaultMethod
    const disabledReason = method.active && (isDefault || activeCount <= 1)
      ? isDefault
        ? 'Defina outro método ativo como padrão antes de desativar este.'
        : 'Mantenha pelo menos uma forma de pagamento ativa.'
      : ''
    return {
      id: method.code,
      code: method.code,
      active: method.active,
      dataAttributes: { 'data-payment-code': method.code },
      label: <span className="payment-method-copy">
        <span>{paymentLabel(method.code)}</span>
        <span className="payment-method-badges">
          <span className={method.active ? 'payment-method-badge is-active' : 'payment-method-badge'}>{method.active ? 'Ativo' : 'Inativo'}</span>
          {isDefault && <span className="payment-method-badge is-default">Padrão</span>}
        </span>
      </span>,
      onKeyDown: locked ? undefined : (event) => {
        if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return
        event.preventDefault()
        move(method.code, event.key === 'ArrowUp' ? -1 : 1)
      },
      actions: readOnly ? [] : [
        {
          id: method.active ? 'deactivate' : 'activate',
          label: method.active ? 'Desativar' : 'Ativar',
          disabledReason: lockedReason || disabledReason,
        },
        ...(method.active && !isDefault ? [{ id: 'default', label: 'Definir como padrão', disabledReason: lockedReason }] : []),
        { id: 'up', label: 'Mover para cima', disabledReason: lockedReason || (index === 0 ? 'Este método já é o primeiro.' : '') },
        { id: 'down', label: 'Mover para baixo', disabledReason: lockedReason || (index === methods.length - 1 ? 'Este método já é o último.' : '') },
      ],
    }
  })

  return <SettingsEditorShell
    title="Formas de pagamento"
    description="Ative os métodos aceitos, defina o padrão e escolha a ordem das novas seleções."
    scope="Todo o negócio"
    effectiveNotice="As mudanças valem para novas escolhas. Pagamentos e estornos já registrados preservam o método original."
    state={resourceState}
    readOnly={readOnly}
    onSave={onSave}
    onDiscard={onDiscard}
    onReconcile={onReconcile}
    onReload={onReload}
    onReviewConflict={onReviewConflict}
  >
    {!data
      ? <p className="settings-empty-state">Os métodos confirmados aparecerão quando esta configuração estiver disponível.</p>
      : <div className="payment-settings-list">
        <p className="payment-settings-help">Use os botões ou Alt + seta para cima/baixo para reordenar.</p>
        <SettingsItemList
          label="Formas de pagamento"
          items={items}
          getActions={(item) => item.actions}
          onAction={action}
        />
      </div>}
  </SettingsEditorShell>
}

export default PaymentSettings
