import {
  renderEscPos58mm as renderPureEscPos58mm,
  wrapPrintText,
} from '../domains/printing/domain/rendering/escpos58mm.js'

export { wrapPrintText }

const defaultCanvasFactory = () => {
  const canvas = globalThis.document?.createElement?.('canvas')
  if (!canvas) throw new Error('Canvas is unavailable for MPT-II bitmap rendering')
  return canvas
}

export const renderEscPos58mm = (document, options = {}) => renderPureEscPos58mm(document, {
  ...options,
  createCanvas: options.createCanvas ?? defaultCanvasFactory,
})
