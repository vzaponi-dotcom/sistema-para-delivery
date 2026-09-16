const clone = (value) => value == null ? value : structuredClone(value)
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)

export function createPolicyEditingState() {
  return {
    status: 'idle', confirmed: null, base: null, draft: null, submitted: null,
    dirty: false, error: null,
  }
}

export function policyEditingReducer(state, event) {
  switch (event?.type) {
    case 'loading':
      return { ...state, status: 'loading', error: null }
    case 'loaded': {
      const value = clone(event.value)
      const currentRevision = state.confirmed?.revision
      const incomingRevision = value?.revision
      if (Number.isSafeInteger(currentRevision) && Number.isSafeInteger(incomingRevision) && incomingRevision < currentRevision) return state
      const preservesIntent = state.dirty || Boolean(state.submitted) || ['saving', 'unconfirmed', 'conflict'].includes(state.status)
      if (preservesIntent) return { ...state, confirmed: value }
      return { status: 'ready', confirmed: value, base: clone(value), draft: clone(value?.data), submitted: null, dirty: false, error: null }
    }
    case 'loadFailed':
      return { ...state, status: 'error', error: event.error?.message || 'N\u00e3o foi poss\u00edvel carregar esta configura\u00e7\u00e3o.' }
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
          ? 'A grava\u00e7\u00e3o pendente expirou ap\u00f3s 24 horas. Recarregue o estado atual antes de decidir novamente.'
          : 'Resultado da grava\u00e7\u00e3o n\u00e3o confirmado.',
      }
    case 'saveUnconfirmed':
      return { ...state, status: 'unconfirmed', error: event.error?.message || 'Resultado da grava\u00e7\u00e3o n\u00e3o confirmado.' }
    case 'expiredRefreshed': {
      const value = clone(event.value)
      const hasInMemoryDraft = Object.hasOwn(state.submitted || {}, 'data')
      const draft = hasInMemoryDraft ? clone(state.draft) : clone(value?.data)
      return { status: 'ready', confirmed: value, base: clone(value), draft, submitted: null, dirty: !same(draft, value?.data), error: null }
    }
    case 'saveConflict':
      return { ...state, status: 'conflict', error: event.error?.message || 'As configura\u00e7\u00f5es foram alteradas em outro dispositivo.' }
    case 'conflictReviewAccepted':
      return { ...state, status: 'ready', base: clone(state.confirmed), submitted: null, error: null }
    case 'saveFailed':
      return { ...state, status: 'error', submitted: null, error: event.error?.message || 'N\u00e3o foi poss\u00edvel salvar esta configura\u00e7\u00e3o.' }
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
