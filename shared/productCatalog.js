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

export const CATEGORY_ICON_NAMES = {
  Refeições: 'meal',
  Lanches: 'snack',
  Combos: 'combo',
  Porções: 'portion',
  Bebidas: 'drink',
  Sobremesas: 'dessert',
  Adicionais: 'plus',
  Molhos: 'sauce',
  Outros: 'package',
}

export const PRODUCT_CATEGORY_OPTIONS = PRODUCT_CATEGORIES.map((value) => ({ value, label: value }))

const CATEGORY_SET = new Set(PRODUCT_CATEGORIES)
const PRESENTATION_TYPES = new Set(['unit', 'size', 'volume', 'weight'])
const DEFAULT_PRESENTATION = {
  Refeições: 'size',
  Lanches: 'size',
  Combos: 'unit',
  Porções: 'size',
  Bebidas: 'volume',
  Sobremesas: 'unit',
  Adicionais: 'unit',
  Molhos: 'unit',
  Outros: 'unit',
}

export const categoryForUi = (category) => CATEGORY_SET.has(category) ? category : 'Outros'

export const suggestPresentationType = (category) => DEFAULT_PRESENTATION[categoryForUi(category)] || 'unit'

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
    return {
      ok: true,
      value: { presentationType: 'unit', presentationValue: '', presentationUnit: '', size: 'Un' },
    }
  }

  if (presentationType === 'size') {
    const presentationValue = String(input.presentationValue ?? '').trim()
    if (!presentationValue || presentationValue.length > 24) {
      return { ok: false, field: 'presentationValue', message: 'Informe um tamanho com até 24 caracteres.' }
    }
    return {
      ok: true,
      value: { presentationType: 'size', presentationValue, presentationUnit: '', size: presentationValue },
    }
  }

  const normalized = String(input.presentationValue ?? '').trim().replace(',', '.')
  if (!/^\d+(?:\.\d+)?$/.test(normalized) || Number(normalized) <= 0) {
    return { ok: false, field: 'presentationValue', message: 'Informe um valor maior que zero.' }
  }

  const allowedUnits = presentationType === 'volume' ? ['ml', 'L'] : ['g', 'kg']
  if (!allowedUnits.includes(input.presentationUnit)) {
    return { ok: false, field: 'presentationUnit', message: 'Selecione uma unidade válida.' }
  }

  const value = {
    presentationType,
    presentationValue: String(Number(normalized)),
    presentationUnit: input.presentationUnit,
  }

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
