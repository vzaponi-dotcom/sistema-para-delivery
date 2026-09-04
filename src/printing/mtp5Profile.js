export const MTP5_PROFILE = Object.freeze({
  paperWidthMm: 58,
  printableWidthMm: 48,
  dotsPerLine: 384,
  fontAColumns: 32,
  codePage: 3,
  serial: Object.freeze({
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    flowControl: 'none',
  }),
  feedLinesAfterJob: 4,
})
