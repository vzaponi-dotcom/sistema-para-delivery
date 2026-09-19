export const PRODUCT_CATEGORIES = [
  'Refeições',
  'Lanches',
  'Combos',
  'Porções',
  'Bebidas',
  'Sobremesas',
  'Adicionais',
  'Molhos',
  'Outros',
]

const PRESENTATION_TYPES = new Set(['unit', 'size', 'volume', 'weight'])

const localizedDecimal = (value) => String(Number(value)).replace('.', ',')

export const deriveLegacySize = ({ presentationType, presentationValue, presentationUnit }) => {
  if (presentationType === 'unit') return 'Un'
  if (presentationType === 'size') return String(presentationValue ?? '').trim()
  return `${localizedDecimal(presentationValue)} ${presentationUnit}`
}

export const validateProductPresentation = (input = {}) => {
  const presentationType = input.presentationType
  if (!PRESENTATION_TYPES.has(presentationType)) {
    return { ok: false, field: 'presentationType', message: 'Selecione uma apresentação válida.' }
  }
  if (presentationType === 'unit') {
    return { ok: true, value: { presentationType: 'unit', presentationValue: '', presentationUnit: '', size: 'Un' } }
  }
  if (presentationType === 'size') {
    const presentationValue = String(input.presentationValue ?? '').trim()
    if (!presentationValue || presentationValue.length > 24) {
      return { ok: false, field: 'presentationValue', message: 'Informe um tamanho com até 24 caracteres.' }
    }
    return { ok: true, value: { presentationType: 'size', presentationValue, presentationUnit: '', size: presentationValue } }
  }
  const normalized = String(input.presentationValue ?? '').trim().replace(',', '.')
  if (!/^\d+(?:\.\d+)?$/.test(normalized) || Number(normalized) <= 0) {
    return { ok: false, field: 'presentationValue', message: 'Informe um valor maior que zero.' }
  }
  const allowedUnits = presentationType === 'volume' ? ['ml', 'L'] : ['g', 'kg']
  if (!allowedUnits.includes(input.presentationUnit)) {
    return { ok: false, field: 'presentationUnit', message: 'Selecione uma unidade válida.' }
  }
  const value = { presentationType, presentationValue: String(Number(normalized)), presentationUnit: input.presentationUnit }
  return { ok: true, value: { ...value, size: deriveLegacySize(value) } }
}

export const formatProductPresentation = (product = {}) => {
  if (product.presentationType === 'unit') return 'Unidade'
  if (product.presentationType === 'size') return String(product.presentationValue || product.size || '').trim()
  if (['volume', 'weight'].includes(product.presentationType) && product.presentationValue && product.presentationUnit) {
    return `${localizedDecimal(product.presentationValue)} ${product.presentationUnit}`
  }
  return String(product.size || 'Unidade').trim()
}
