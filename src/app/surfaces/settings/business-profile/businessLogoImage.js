export const BUSINESS_LOGO_MAX_BYTES = 1024 * 1024
export const BUSINESS_LOGO_MAX_DIMENSION = 1024

const ACCEPTED_INPUT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const WEBP_QUALITY_STEPS = Object.freeze([0.86, 0.76, 0.66, 0.56, 0.46, 0.36])
const MIN_DIMENSION = 128

const imageError = (code, message, cause) => Object.assign(new Error(message), {
  code,
  ...(cause ? { cause } : {}),
})

const invalid = (cause) => imageError(
  'BUSINESS_LOGO_INVALID',
  'Selecione uma imagem PNG, JPG ou WebP válida.',
  cause,
)

const tooLarge = () => imageError(
  'BUSINESS_LOGO_TOO_LARGE',
  'Não foi possível reduzir o logo para o limite de 1 MiB.',
)

export const sha256Blob = async (blob) => {
  if (!(blob instanceof Blob)) throw invalid()
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

const defaultDecodeImage = async (blob) => {
  if (typeof createImageBitmap !== 'function') throw invalid()
  const bitmap = await createImageBitmap(blob)
  return {
    source: bitmap,
    width: bitmap.width,
    height: bitmap.height,
    close: () => bitmap.close?.(),
  }
}

const canvasBlob = (canvas, type, quality) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob)
    else reject(invalid())
  }, type, quality)
})

const defaultEncodeWebp = async (source, { width, height, quality }) => {
  let canvas
  if (typeof OffscreenCanvas === 'function') {
    canvas = new OffscreenCanvas(width, height)
  } else if (typeof document !== 'undefined') {
    canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
  } else {
    throw invalid()
  }

  const context = canvas.getContext('2d')
  if (!context) throw invalid()
  context.clearRect(0, 0, width, height)
  context.drawImage(source, 0, 0, width, height)

  if (typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type: 'image/webp', quality })
  }
  return canvasBlob(canvas, 'image/webp', quality)
}

const boundedDimensions = (width, height) => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw invalid()
  const scale = Math.min(1, BUSINESS_LOGO_MAX_DIMENSION / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

const shrinkDimensions = ({ width, height }) => {
  const largest = Math.max(width, height)
  if (largest <= MIN_DIMENSION) return null
  const scale = Math.max(MIN_DIMENSION / largest, 0.85)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export async function normalizeBusinessLogo(blob, {
  decodeImage = defaultDecodeImage,
  encodeWebp = defaultEncodeWebp,
} = {}) {
  if (!(blob instanceof Blob) || !ACCEPTED_INPUT_TYPES.has(blob.type)) throw invalid()

  let decoded
  try {
    decoded = await decodeImage(blob)
  } catch (cause) {
    if (cause?.code === 'BUSINESS_LOGO_INVALID') throw cause
    throw invalid(cause)
  }

  try {
    let dimensions = boundedDimensions(decoded?.width, decoded?.height)
    const source = decoded?.source ?? decoded

    while (dimensions) {
      for (const quality of WEBP_QUALITY_STEPS) {
        let output
        try {
          output = await encodeWebp(source, { ...dimensions, quality })
        } catch (cause) {
          if (cause?.code === 'BUSINESS_LOGO_INVALID') throw cause
          throw invalid(cause)
        }
        if (!(output instanceof Blob) || output.type !== 'image/webp') throw invalid()
        if (output.size <= BUSINESS_LOGO_MAX_BYTES) {
          return {
            blob: output,
            sha256: await sha256Blob(output),
            width: dimensions.width,
            height: dimensions.height,
            sizeBytes: output.size,
            contentType: 'image/webp',
          }
        }
      }
      dimensions = shrinkDimensions(dimensions)
    }
    throw tooLarge()
  } finally {
    decoded?.close?.()
  }
}

export function createBusinessLogoPreviewOwner({
  createObjectURL = (blob) => URL.createObjectURL(blob),
  revokeObjectURL = (url) => URL.revokeObjectURL(url),
} = {}) {
  let currentUrl = null
  const clear = () => {
    if (currentUrl) revokeObjectURL(currentUrl)
    currentUrl = null
  }
  return Object.freeze({
    replace(blob) {
      if (!(blob instanceof Blob)) throw invalid()
      clear()
      currentUrl = createObjectURL(blob)
      return currentUrl
    },
    clear,
    dispose: clear,
    current: () => currentUrl,
  })
}
