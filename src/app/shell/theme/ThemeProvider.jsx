import { useEffect, useState } from 'react'
import {
  applyThemePreference,
  applyVisualTheme,
  readThemePreference,
  readVisualTheme,
  saveThemePreference,
  saveVisualTheme,
} from './theme.js'
import { ThemeContext } from './themeContext.js'

export function ThemeProvider({ children }) {
  const [themePreference, setThemePreferenceState] = useState(() => readThemePreference())
  const [visualTheme, setVisualThemeState] = useState(() => readVisualTheme())

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const applyCurrentTheme = () => applyThemePreference(themePreference, {
      root: document.documentElement,
      prefersDark: media.matches,
    })

    applyCurrentTheme()

    if (themePreference !== 'system') return undefined

    media.addEventListener?.('change', applyCurrentTheme)
    return () => media.removeEventListener?.('change', applyCurrentTheme)
  }, [themePreference])

  useEffect(() => {
    if (typeof document === 'undefined') return
    applyVisualTheme(visualTheme, { root: document.documentElement })
  }, [visualTheme])

  const setThemePreference = (preference) => {
    try {
      const normalized = saveThemePreference(preference)
      setThemePreferenceState(normalized)
      return true
    } catch {
      return false
    }
  }

  const setVisualTheme = (nextVisualTheme) => {
    try {
      const normalized = saveVisualTheme(nextVisualTheme)
      setVisualThemeState(normalized)
      return true
    } catch {
      return false
    }
  }

  return (
    <ThemeContext.Provider value={{ themePreference, setThemePreference, visualTheme, setVisualTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
