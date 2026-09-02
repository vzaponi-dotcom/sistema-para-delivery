import { useEffect, useState } from 'react'
import { applyThemePreference, readThemePreference, saveThemePreference } from '../utils/theme.js'
import { ThemeContext } from './themeContext.js'

export function ThemeProvider({ children }) {
  const [themePreference, setThemePreferenceState] = useState(() => readThemePreference())

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

  const setThemePreference = (preference) => {
    const normalized = saveThemePreference(preference)
    setThemePreferenceState(normalized)
  }

  return (
    <ThemeContext.Provider value={{ themePreference, setThemePreference }}>
      {children}
    </ThemeContext.Provider>
  )
}
