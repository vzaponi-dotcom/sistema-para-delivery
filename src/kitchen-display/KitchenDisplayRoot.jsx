import { StrictMode } from 'react'
import './kitchen-display.css'

export function KitchenDisplayRoot() {
  return <main className="kds-shell"><p>Carregando painel da cozinha…</p></main>
}

export async function mount(container) {
  const { createRoot } = await import('react-dom/client')
  createRoot(container).render(<StrictMode><KitchenDisplayRoot /></StrictMode>)
}
