export const getSessionStorage = (windowLike = typeof window === 'undefined' ? undefined : window) => {
  try {
    return windowLike?.sessionStorage
  } catch {
    return undefined
  }
}
