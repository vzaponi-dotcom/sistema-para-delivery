import { createContext, useContext } from 'react'

export const ThemeContext = createContext({
  themePreference: 'system',
  setThemePreference: () => {},
  visualTheme: 'classic',
  setVisualTheme: () => {},
})

export const useTheme = () => useContext(ThemeContext)
