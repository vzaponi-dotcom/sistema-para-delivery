export const THEME_STORAGE_KEY = 'delivery-theme'
export const THEME_PREFERENCES = ['light', 'dark', 'system']
export const VISUAL_THEME_STORAGE_KEY = 'delivery-visual-theme'
export const VISUAL_THEMES = ['classic', 'mesiva']

export const normalizeThemePreference = (value) => THEME_PREFERENCES.includes(value) ? value : 'system'
export const normalizeVisualTheme = (value) => VISUAL_THEMES.includes(value) ? value : 'classic'

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
  if (!storage?.setItem) throw Object.assign(new Error('Armazenamento local indisponível.'), { code: 'DEVICE_STORAGE_UNAVAILABLE' })
  storage.setItem(THEME_STORAGE_KEY, normalized)
  return normalized
}

export const readVisualTheme = (storage = browserStorage()) => {
  try {
    return normalizeVisualTheme(storage?.getItem(VISUAL_THEME_STORAGE_KEY))
  } catch {
    return 'classic'
  }
}

export const saveVisualTheme = (visualTheme, storage = browserStorage()) => {
  const normalized = normalizeVisualTheme(visualTheme)
  if (!storage?.setItem) throw Object.assign(new Error('Armazenamento local indisponível.'), { code: 'DEVICE_STORAGE_UNAVAILABLE' })
  storage.setItem(VISUAL_THEME_STORAGE_KEY, normalized)
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

export const applyVisualTheme = (visualTheme, { root = browserRoot() } = {}) => {
  const normalized = normalizeVisualTheme(visualTheme)
  if (root) root.dataset.visualTheme = normalized
  return normalized
}

export const initializeTheme = () => {
  let prefersDark = false
  try {
    prefersDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {}

  applyVisualTheme(readVisualTheme())
  return applyThemePreference(readThemePreference(), { prefersDark })
}
