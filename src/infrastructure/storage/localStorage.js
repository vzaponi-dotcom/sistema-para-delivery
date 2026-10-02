export const getLocalStorage = () => {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}
