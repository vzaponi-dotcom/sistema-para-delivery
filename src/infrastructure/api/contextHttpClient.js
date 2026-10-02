import { requestError } from './httpClient.js'

// The marker belongs to this client, even when its caller outlives the screen.
export const createContextHttpClient = ({ context, fetchImpl = (...args) => fetch(...args), onContextChanged } = {}) => {
  const contextId = context?.contextId
  const send = async (path, options, mode) => {
    const headers = new Headers(options?.headers)
    if (contextId) headers.set('X-Mesiva-Context', contextId)
    if (!(options?.body instanceof FormData) && !headers.has('content-type')) headers.set('content-type', 'application/json')
    const response = await fetchImpl(path, { ...options, headers: Object.fromEntries(headers), credentials: 'same-origin' })
    if (!response.ok) {
      const error = requestError(response, await response.json().catch(() => null))
      if (error.code === 'SESSION_CONTEXT_CHANGED') onContextChanged?.(error)
      throw error
    }
    if (mode === 'json') return response.json().catch(() => null)
    return response[mode]()
  }
  return Object.freeze({ contextId, request: (path, options = {}) => send(path, options, 'json'), text: (path, options = {}) => send(path, options, 'text'), blob: (path, options = {}) => send(path, options, 'blob') })
}
