export function cancellationOptionsFromEffective(config) {
  if (!Array.isArray(config?.cancellationReasons?.items)) return []
  return config.cancellationReasons.items
    .filter((item) => typeof item?.id === 'string' && item.id
      && typeof item?.label === 'string' && item.label
      && typeof item?.requiresNote === 'boolean')
    .map(({ id, label, requiresNote }) => ({ value: id, label, id, requiresNote }))
}

export function cancellationRevisionFromEffective(config) {
  const revision = config?.revisions?.cancellationReasons
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : null
}

export const cancellationSelectionNeedsReview = (options, value) => Boolean(value)
  && !options.some((option) => option.value === value)

export function cancellationOptionsWithSelection(options, value, label = value) {
  if (!cancellationSelectionNeedsReview(options, value)) return options
  return [{ value, label: `${label || value} (inativo)`, id: value, requiresNote: false, inactive: true }, ...options]
}
