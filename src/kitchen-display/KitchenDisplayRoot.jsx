import { StrictMode } from 'react'
import './kitchenDisplayLegacyCompat.js'
import { KitchenDisplayApp } from './KitchenDisplayApp.jsx'
import './kitchen-display.css'

export function KitchenDisplayRoot() {
  return <KitchenDisplayApp />
}

export async function mount(container) {
  const { createRoot } = await import('react-dom/client')
  createRoot(container).render(<StrictMode><KitchenDisplayRoot /></StrictMode>)
}
