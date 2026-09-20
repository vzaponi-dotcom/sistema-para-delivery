const lockStates = new WeakMap()

export const acquireScrollLock = (documentRef = typeof document === 'undefined' ? null : document) => {
  if (!documentRef?.body?.style || !documentRef.documentElement?.style) return () => {}

  let state = lockStates.get(documentRef)
  if (!state) {
    state = {
      count: 0,
      bodyOverflow: documentRef.body.style.overflow,
      htmlOverflow: documentRef.documentElement.style.overflow,
    }
    lockStates.set(documentRef, state)
  }

  state.count += 1
  documentRef.body.style.overflow = 'hidden'
  documentRef.documentElement.style.overflow = 'hidden'

  let released = false
  return () => {
    if (released) return
    released = true
    state.count -= 1
    if (state.count > 0) return

    documentRef.body.style.overflow = state.bodyOverflow
    documentRef.documentElement.style.overflow = state.htmlOverflow
    lockStates.delete(documentRef)
  }
}
