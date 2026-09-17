export function reorderPaymentMethods(methods, sourceIndex, targetIndex) {
  const normalized = methods.map((method, sortOrder) => ({ ...method, sortOrder }))
  if (
    sourceIndex < 0 || targetIndex < 0 ||
    sourceIndex >= normalized.length || targetIndex >= normalized.length ||
    sourceIndex === targetIndex
  ) return normalized

  const next = [...normalized]
  const [method] = next.splice(sourceIndex, 1)
  next.splice(targetIndex, 0, method)
  return next.map((item, sortOrder) => ({ ...item, sortOrder }))
}
