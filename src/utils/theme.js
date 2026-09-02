export const THEME_STORAGE_KEY = 'delivery-theme'
export const THEME_PREFERENCES = ['light', 'dark', 'system']

export const normalizeThemePreference = (value) => THEME_PREFERENCES.includes(value) ? value : 'system'

export const resolveTheme = (preference, prefersDark = false) => {
  const normalized = normalizeThemePreference(preference)
  if (normalized === 'system') return prefersDark ? 'dark' : 'light'
  return normalized
}

const browserStorage = () => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export const readThemePreference = (storage = browserStorage()) => {
  try {
    return normalizeThemePreference(storage?.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'system'
  }
}

export const saveThemePreference = (preference, storage = browserStorage()) => {
  const normalized = normalizeThemePreference(preference)
  try {
    storage?.setItem(THEME_STORAGE_KEY, normalized)
  } catch {}
  return normalized
}

const browserRoot = () => typeof document === 'undefined' ? null : document.documentElement

export const applyThemePreference = (preference, { root = browserRoot(), prefersDark = false } = {}) => {
  const resolved = resolveTheme(preference, prefersDark)
  if (root) {
    root.dataset.theme = resolved
    root.style.colorScheme = resolved
  }
  return resolved
}

export const initializeTheme = () => {
  let prefersDark = false
  try {
    prefersDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {}

  return applyThemePreference(readThemePreference(), { prefersDark })
}
