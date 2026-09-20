export const getDefaultPrintStationName = (platform) => {
  if (platform === 'windows') return 'Cozinha · Windows'
  if (platform === 'android') return 'Cozinha · Android'
  return 'Cozinha · Navegador'
}

export const isQzPrintStationEligible = ({ platform, qzPrinterName } = {}) => (
  platform === 'windows' && Boolean(String(qzPrinterName ?? '').trim())
)
