export const apiError = (status, code, message) => Object.assign(new Error(message), { status, code })

export const json = (data, init = {}) => {
  const headers = new Headers(init.headers || {})
  if (!headers.has('content-type')) headers.set('content-type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(data), { ...init, headers })
}

export const readJson = async (request) => {
  let body
  try {
    body = await request.json()
  } catch {
    throw apiError(400, 'INVALID_JSON', 'Envie um JSON válido.')
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw apiError(400, 'INVALID_JSON', 'O corpo da requisição deve ser um objeto JSON.')
  }

  return body
}

export const assertSameOriginMutation = (request) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method.toUpperCase())) return
  const origin = request.headers.get('origin')
  const expected = new URL(request.url).origin
  if (!origin || origin !== expected) {
    throw apiError(403, 'ORIGIN_NOT_ALLOWED', 'Origem da requisição não permitida.')
  }
}

export const handleError = (error) => {
  const status = Number.isInteger(error?.status) ? error.status : 500
  const code = typeof error?.code === 'string' ? error.code : 'INTERNAL_ERROR'
  const message = status >= 500 && code === 'INTERNAL_ERROR'
    ? 'Não foi possível concluir a operação.'
    : (error?.message || 'Não foi possível concluir a operação.')

  if (status >= 500) console.error('Worker error', { name: error?.name || 'Error', code, status })
  return json({ error: { code, message } }, { status })
}
