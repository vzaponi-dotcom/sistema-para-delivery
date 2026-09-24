const kitchenTvPath = window.location.pathname === '/cozinha-tv'

const renderKitchenBootstrapError = (error) => {
  const root = document.getElementById('root')
  if (!root) return
  root.innerHTML = ''
  const main = document.createElement('main')
  main.style.cssText = 'min-height:100vh;display:grid;place-items:center;padding:24px;background:#061019;color:#f7f9fc;font-family:Arial,sans-serif;text-align:center'
  const box = document.createElement('div')
  const title = document.createElement('h1')
  const copy = document.createElement('p')
  const detail = document.createElement('small')
  title.textContent = 'Não foi possível iniciar a TV da Cozinha'
  copy.textContent = 'Este navegador pode precisar do modo de compatibilidade. Atualize a página e tente novamente.'
  detail.textContent = error && error.message ? error.message : 'KDS_COMPAT_BOOT'
  box.appendChild(title)
  box.appendChild(copy)
  box.appendChild(detail)
  main.appendChild(box)
  root.appendChild(main)
}

const bootstrap = async () => {
  const container = document.getElementById('root')
  if (kitchenTvPath) {
    const module = await import('./kitchen-display/KitchenDisplayRoot.jsx')
    await module.mount(container)
    return
  }

  const module = await import('./admin/AdminBootstrap.jsx')
  await module.mount(container)
}

bootstrap().catch((error) => {
  if (kitchenTvPath) {
    renderKitchenBootstrapError(error)
    return
  }
  setTimeout(() => { throw error }, 0)
})
