export const runManualPrintDocument = async ({ document, port, renderer, transport }) => {
  const bytes = renderer(document, { copies: 1 })
  await transport(port, bytes)
  return { status: 'printed', copiesPrinted: 1 }
}
