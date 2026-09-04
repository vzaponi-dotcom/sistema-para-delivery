const printingError = (code, message, cause) => Object.assign(new Error(message, cause ? { cause } : undefined), { code })

export const isWebSerialSupported = (serial = globalThis.navigator?.serial) => Boolean(serial?.requestPort && serial?.getPorts)

export const requestPrinterPort = async (serial = globalThis.navigator?.serial) => {
  if (!isWebSerialSupported(serial)) {
    throw printingError('WEB_SERIAL_UNSUPPORTED', 'Este navegador não oferece impressão Bluetooth compatível.')
  }
  return serial.requestPort()
}

export const probeSerialPort = async (port, serialOptions) => {
  if (!port?.open || !port?.close) {
    throw printingError('SERIAL_OPEN_FAILED', 'Não foi possível conectar à impressora.')
  }
  let opened = false
  try {
    await port.open(serialOptions)
    opened = true
    await port.close()
    opened = false
  } catch (error) {
    if (opened) {
      try { await port.close() } catch { /* best effort */ }
    }
    throw printingError('SERIAL_OPEN_FAILED', 'Não foi possível conectar à impressora.', error)
  }
}

export const writeSerialBytes = async (port, bytes, serialOptions) => {
  if (!port?.open || !port?.close) {
    throw printingError('SERIAL_OPEN_FAILED', 'Não foi possível conectar à impressora.')
  }

  let opened = false
  let writer = null
  let writeStarted = false
  try {
    await port.open(serialOptions)
    opened = true
    if (!port.writable?.getWriter) throw new Error('Porta serial sem canal de escrita.')
    writer = port.writable.getWriter()
    writeStarted = true
    await writer.write(bytes)
    writer.releaseLock()
    writer = null
    await port.close()
    opened = false
  } catch (error) {
    if (writer) {
      try { writer.releaseLock() } catch { /* best effort */ }
      writer = null
    }
    if (opened) {
      try { await port.close() } catch { /* best effort */ }
    }
    if (writeStarted) {
      throw printingError('SERIAL_WRITE_UNCERTAIN', 'A conexão caiu durante a impressão. O resultado físico é incerto.', error)
    }
    throw printingError('SERIAL_OPEN_FAILED', 'Não foi possível conectar à impressora.', error)
  }
}
