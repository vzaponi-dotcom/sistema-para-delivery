import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './success-feedback.css'
import App from './App.jsx'
import { ThemeProvider } from './app/shell/theme/ThemeProvider.jsx'
import { initializeTheme } from './app/shell/theme/theme.js'
import './theme.css'
import './product-selection.css'
import './mobile-compact-controls.css'

initializeTheme()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
