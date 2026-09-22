export class KitchenDisplayHttpError extends Error {
  constructor(status, message = 'Kitchen TV request failed') {
    super(message)
    this.name = 'KitchenDisplayHttpError'
    this.status = status
    this.definitive = status === 401 || status === 403
  }
}

async function requestJson(path, init, fetchImpl) {
  const response = await fetchImpl(path, { credentials: 'same-origin', ...init })
  if (!response.ok) {
    let message = `Kitchen TV request failed (${response.status})`
    try {
      const payload = await response.json()
      if (payload?.message) message = payload.message
    } catch {
      // Status is the authoritative boundary when the server did not return JSON.
    }
    throw new KitchenDisplayHttpError(response.status, message)
  }
  return response.json()
}

export const pairKitchenDisplay = (token, fetchImpl = globalThis.fetch) => requestJson('/api/kitchen-tv/pair', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ token }),
}, fetchImpl)

export const readKitchenDisplayState = (fetchImpl = globalThis.fetch) => requestJson('/api/kitchen-tv/state', {
  method: 'GET',
}, fetchImpl)
