import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (relativePath) => fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8')

test('runtime product branding uses Mesiva instead of the legacy Gestão Delivery name', () => {
  const runtimeFiles = [
    './app/shell/AppTopBar.jsx',
    './app/shell/OperationMenu.jsx',
    './app/notifications/NotificationCenter.jsx',
    './app/notifications/ReleaseNotesModal.jsx',
    './app/notifications/notificationCatalog.js',
    './kitchen-display/KitchenDisplayApp.jsx',
  ]

  for (const relativePath of runtimeFiles) {
    const file = read(relativePath)
    assert.doesNotMatch(file, /Gestão Delivery/i, `${relativePath} should not expose the legacy product name`)
  }

  assert.match(read('./app/shell/AppTopBar.jsx'), /Mesiva/)
  assert.match(read('./app/shell/OperationMenu.jsx'), /Sobre a Mesiva/)
  assert.match(read('./app/notifications/NotificationCenter.jsx'), /novidades da Mesiva/i)
  assert.match(read('./app/notifications/ReleaseNotesModal.jsx'), /Novidades da Mesiva/)
  assert.match(read('./kitchen-display/KitchenDisplayApp.jsx'), />Mesiva</)
})

test('login and loading states do not hardcode the current business identity', () => {
  const login = read('./app/shell/LoginScreen.jsx')
  const root = read('./app/shell/AppRoot.jsx')

  assert.doesNotMatch(login, /Amor\s*&(?:amp;)?\s*Sabor/i)
  assert.doesNotMatch(root, /Amor\s*&(?:amp;)?\s*Sabor/i)
  assert.doesNotMatch(login, /BrandLogo/)
  assert.match(login, /Mesiva/)
  assert.match(login, /PIN da operação/i)
  assert.match(root, /Sincronizando os dados da operação/)
})

test('sidebar and browser chrome do not expose operation-specific or technical branding', () => {
  const sidebar = read('./app/shell/Sidebar.jsx')
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8')

  assert.doesNotMatch(sidebar, /Comida caseira, gestão simples/i)
  assert.doesNotMatch(html, /sistema-para-delivery/i)
  assert.match(html, /<title>Mesiva<\/title>/)
})

test('runtime print fallbacks are business-neutral instead of hardcoded Amor & Sabor', () => {
  const runtimeFiles = [
    '../shared/orderPrintDocument.js',
    '../shared/tableTabPrintDocument.js',
    './domains/printing/ui/OrderTicketPreview.jsx',
    './domains/printing/ui/TableTabTicketPreview.jsx',
    './domains/printing/domain/rendering/escpos58mm.js',
    './domains/printing/domain/rendering/pdfOrderRenderer.js',
    '../worker/repositories.js',
    '../worker/orderPrintingApi.js',
  ]

  for (const relativePath of runtimeFiles) {
    const file = read(relativePath)
    assert.doesNotMatch(file, /Amor\s*&\s*Sabor/i, `${relativePath} should not hardcode a business name`)
  }
})

test('release pairing illustration no longer exposes legacy product or domain copy', () => {
  const asset = fs.readFileSync(new URL('../public/release/kitchen-tv-pairing.svg', import.meta.url), 'utf8')

  assert.doesNotMatch(asset, /GESTÃO DELIVERY/i)
  assert.doesNotMatch(asset, /zaponidigital/i)
  assert.match(asset, />MESIVA</)
  assert.match(asset, /mesiva\.com\.br\/cozinha-tv/)
})
