const module = window.location.pathname === '/cozinha-tv'
  ? await import('./kitchen-display/KitchenDisplayRoot.jsx')
  : await import('./admin/AdminBootstrap.jsx')

await module.mount(document.getElementById('root'))
