export const buildRequestOptions = (options = {}) => ({
  ...options,
  credentials: 'same-origin',
  headers: { 'content-type': 'application/json', ...(options.headers || {}) },
})

export const requestError = (response, payload) => {
  const error = new Error(payload?.error?.message || 'Não foi possível concluir a operação.')
  error.status = response.status
  error.code = payload?.error?.code || 'REQUEST_FAILED'
  return error
}

export const apiRequest = async (path, options = {}) => {
  const response = await fetch(path, buildRequestOptions(options))
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw requestError(response, payload)
  return payload
}

export const apiTextRequest = async (path, options = {}) => {
  const response = await fetch(path, buildRequestOptions(options))
  const text = await response.text()
  if (!response.ok) {
    let payload = null
    try {
      payload = JSON.parse(text)
    } catch {
      // Plain-text failures fall back to the standard request error below.
    }
    throw requestError(response, payload)
  }
  return text
}

export const withJson = (method, payload) => ({ method, body: JSON.stringify(payload) })
