export function financeCategoryOptionsFromEffective(config, type = null) {
  if (!hasCategoryItems(config) || (type !== null && !['entrada', 'saida'].includes(type))) return []
  return config.financeCategories.items
    .filter((item) => type === null || item.type === type)
    .filter((item) => typeof item.id === 'string' && item.id
      && ['entrada', 'saida'].includes(item.type)
      && typeof item.label === 'string' && item.label)
    .map(({ id, type: categoryType, label }) => ({ value: id, id, type: categoryType, label }))
}

const hasCategoryItems = (config) => Array.isArray(config?.financeCategories?.items)

export function financeCategoryRevisionFromEffective(config) {
  const revision = config?.revisions?.financeCategories
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : null
}

export const financeCategorySelectionNeedsReview = (options, type, value) => Boolean(value)
  && !options.some((option) => option.type === type && option.value === value)

export function financeCategoryOptionsWithSelection(options, type, value, label = value) {
  const typed = options.filter((option) => option.type === type)
  if (!financeCategorySelectionNeedsReview(options, type, value)) return typed
  return [{ value, id: value, type, label: `${label || value} (inativa)`, inactive: true }, ...typed]
}
