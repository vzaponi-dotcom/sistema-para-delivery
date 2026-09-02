import { createContext, useContext } from 'react'

export const ThemeContext = createContext({
  themePreference: 'system',
  setThemePreference: () => {},
})

export const useTheme = () => useContext(ThemeContext)
