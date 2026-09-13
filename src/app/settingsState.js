const clone = (value) => value == null ? value : structuredClone(value)
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)

export function createSettingsState() {
  return {
    status: 'idle', confirmed: null, base: null, draft: null, submitted: null,
    dirty: false, error: null,
  }
}

export function settingsReducer(state, event) {
  switch (event?.type) {
    case 'loading':
      return { ...state, status: 'loading', error: null }
    case 'loaded': {
      const value = clone(event.value)
      return { status: 'ready', confirmed: value, base: clone(value), draft: clone(value?.data), submitted: null, dirty: false, error: null }
    }
    case 'loadFailed':
      return { ...state, status: 'error', error: event.error?.message || 'Não foi possível carregar esta configuração.' }
    case 'edited': {
      const draft = clone(event.data)
      return { ...state, draft, dirty: !same(draft, state.base?.data), error: null }
    }
    case 'discarded':
      return { ...state, status: 'ready', draft: clone(state.confirmed?.data), base: clone(state.confirmed), submitted: null, dirty: false, error: null }
    case 'saveStarted':
      return {
        ...state,
        status: 'saving',
        submitted: {
          mutationId: event.mutationId,
          payloadHash: event.payloadHash,
          startedAt: event.startedAt,
          expectedRevision: event.expectedRevision ?? state.base?.revision,
          data: clone(Object.hasOwn(event, 'data') ? event.data : state.draft),
        },
        error: null,
      }
    case 'pendingRecovered':
      return {
        ...state,
        status: 'unconfirmed',
        submitted: clone(event.pointer),
        error: event.pointer?.expired
          ? 'A gravação pendente expirou após 24 horas. Recarregue o estado atual antes de decidir novamente.'
          : 'Resultado da gravação não confirmado.',
      }
    case 'saveUnconfirmed':
      return { ...state, status: 'unconfirmed', error: event.error?.message || 'Resultado da gravação não confirmado.' }
    case 'saveConflict':
      return { ...state, status: 'conflict', error: event.error?.message || 'As configurações foram alteradas em outro dispositivo.' }
    case 'saveFailed':
      return { ...state, status: 'error', submitted: null, error: event.error?.message || 'Não foi possível salvar esta configuração.' }
    case 'saveConfirmed': {
      const value = clone(event.value)
      const hasLaterDraft = Object.hasOwn(state.submitted || {}, 'data') && !same(state.draft, state.submitted.data)
      const draft = hasLaterDraft ? clone(state.draft) : clone(value?.data)
      return { status: 'ready', confirmed: value, base: clone(value), draft, submitted: null, dirty: !same(draft, value?.data), error: null }
    }
    default:
      return state
  }
}
