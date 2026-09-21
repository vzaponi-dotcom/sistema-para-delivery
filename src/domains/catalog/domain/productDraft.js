import { categoryForUi } from './catalogPresentation.js'
import { formatBRLCurrencyValue, parseBRLCurrencyInput } from '../../../shared/utils/formFormatting.js'

export const createProductDraft = () => ({
  category: 'Refeições',
  presentationType: 'size',
  presentationValue: 'P',
  presentationUnit: '',
  name: '',
  price: formatBRLCurrencyValue(32),
})

export function productToDraft(product) {
  const legacySized = Boolean(product.size && !['Un', 'Unidade'].includes(product.size))
  return {
    category: categoryForUi(product.category),
    presentationType: product.presentationType || (legacySized ? 'size' : 'unit'),
    presentationValue: product.presentationValue ?? (legacySized ? product.size : ''),
    presentationUnit: product.presentationUnit || '',
    name: product.name,
    price: formatBRLCurrencyValue(product.price),
  }
}

export const productPayloadFromDraft = (draft) => ({
  category: draft.category,
  presentationType: draft.presentationType,
  presentationValue: draft.presentationValue,
  presentationUnit: draft.presentationUnit,
  name: draft.name.trim(),
  price: parseBRLCurrencyInput(draft.price),
})
