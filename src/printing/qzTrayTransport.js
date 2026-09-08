const qzError = (code, message, cause) => Object.assign(new Error(message), { code, cause })

const bytesToBase64 = (bytes) => {
  if (!(bytes instanceof Uint8Array)) {
    throw qzError('QZ_PRINT_FAILED', 'Dados de impressão inválidos.')
  }
  if (typeof globalThis.btoa !== 'function') {
    throw qzError('QZ_PRINT_FAILED', 'Não foi possível codificar os dados de impressão.')
  }

  const chunkSize = 0x8000
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return globalThis.btoa(binary)
}

export const configureQzSecurity = ({ qzApi, getCertificate, signPayload }) => {
  qzApi.security.setCertificatePromise((resolve, reject) => {
    getCertificate().then(resolve, reject)
  })
  qzApi.security.setSignatureAlgorithm('SHA512')
  qzApi.security.setSignaturePromise((toSign) => (resolve, reject) => {
    signPayload(toSign).then(resolve, reject)
  })
}

export const ensureQzConnected = async (qzApi) => {
  if (qzApi.websocket.isActive()) return
  try {
    await qzApi.websocket.connect()
  } catch (cause) {
    throw qzError(
      'QZ_UNAVAILABLE',
      'QZ Tray não está disponível. Abra o QZ Tray e tente novamente.',
      cause,
    )
  }
}

export const listQzPrinters = async (qzApi) => {
  await ensureQzConnected(qzApi)
  const printers = await qzApi.printers.find()
  if (Array.isArray(printers)) return printers.map((printer) => String(printer))
  if (printers === null || printers === undefined || printers === '') return []
  return [String(printers)]
}

export const resolveQzPrinter = async (qzApi, printerName) => {
  const selectedName = String(printerName ?? '').trim()
  const printers = await listQzPrinters(qzApi)
  if (!selectedName || !printers.includes(selectedName)) {
    throw qzError(
      'QZ_PRINTER_NOT_FOUND',
      'A impressora configurada não foi encontrada no QZ Tray.',
    )
  }
  return selectedName
}

export const printQzRawBytes = async (qzApi, printerName, bytes) => {
  const selectedPrinter = await resolveQzPrinter(qzApi, printerName)
  try {
    const config = qzApi.configs.create(selectedPrinter)
    await qzApi.print(config, [{
      type: 'raw',
      format: 'command',
      flavor: 'base64',
      data: bytesToBase64(bytes),
    }])
  } catch (cause) {
    if (cause?.code) throw cause
    throw qzError(
      'QZ_PRINT_FAILED',
      'O QZ Tray não conseguiu enviar a impressão para a MPT-II.',
      cause,
    )
  }
}
