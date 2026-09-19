import {
  getOrderPdfFilename,
  renderOrderPdf,
} from '../domains/printing/domain/rendering/pdfOrderRenderer.js'

export { getOrderPdfFilename, renderOrderPdf }

export const downloadOrderPdf = (document, {
  render = renderOrderPdf,
  urlApi = globalThis.URL,
  documentApi = globalThis.document,
} = {}) => {
  if (!documentApi?.createElement || !urlApi?.createObjectURL) throw new Error('Download de PDF indisponível neste ambiente.')
  const bytes = render(document)
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = urlApi.createObjectURL(blob)
  const anchor = documentApi.createElement('a')
  anchor.href = url
  anchor.download = getOrderPdfFilename(document)
  anchor.style.display = 'none'
  documentApi.body?.appendChild?.(anchor)
  try {
    anchor.click()
  } finally {
    anchor.remove?.()
    urlApi.revokeObjectURL(url)
  }
  return { filename: anchor.download, bytes }
}
