import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './success-feedback.css'
import App from './App.jsx'
import { ThemeProvider } from './components/ThemeProvider.jsx'
import { initializeTheme } from './utils/theme.js'
import './theme.css'
import './product-selection.css'

initializeTheme()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
