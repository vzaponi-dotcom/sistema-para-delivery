import { PRODUCT_CATEGORIES } from '../../../../shared/productCatalog.js'

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
