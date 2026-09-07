export const RAWBT_URL_PREFIX = 'rawbt:base64,'

const rawBtError = (code, message, cause) => Object.assign(
  new Error(message, cause ? { cause } : undefined),
  { code },
)

const assertBytes = (bytes) => {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('RawBT payload must be a Uint8Array')
  return bytes
}

export const bytesToRawBtBase64 = (bytes, encodeBase64 = globalThis.btoa) => {
  assertBytes(bytes)
  if (typeof encodeBase64 !== 'function') {
    throw rawBtError('RAWBT_BASE64_UNAVAILABLE', 'Não foi possível preparar a impressão para o RawBT.')
  }

  let binary = ''
  const chunkSize = 8_192
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return encodeBase64(binary)
}

export const createRawBtUrl = (bytes, encodeBase64 = globalThis.btoa) => (
  `${RAWBT_URL_PREFIX}${bytesToRawBtBase64(bytes, encodeBase64)}`
)

export const dispatchRawBtBytes = (
  bytes,
  {
    encodeBase64 = globalThis.btoa,
    navigate = (url) => {
      if (!globalThis.location) throw new Error('Navigation unavailable')
      globalThis.location.href = url
    },
  } = {},
) => {
  const url = createRawBtUrl(bytes, encodeBase64)
  try {
    navigate(url)
    return { dispatched: true, url }
  } catch (error) {
    throw rawBtError('RAWBT_LAUNCH_FAILED', 'Não foi possível abrir o RawBT para imprimir.', error)
  }
}
