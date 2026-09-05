import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as orderWorkflow from './utils/orderWorkflow.js'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')
const readOptional = (path) => read(path).catch(() => '')

test('elapsed duration switches to hours and minutes from one hour onward', () => {
  assert.equal(typeof orderWorkflow.formatElapsedDuration, 'function')
  assert.equal(orderWorkflow.formatElapsedDuration(0), 'agora')
  assert.equal(orderWorkflow.formatElapsedDuration(45), '45 min')
  assert.equal(orderWorkflow.formatElapsedDuration(60), '1h 00 min')
  assert.equal(orderWorkflow.formatElapsedDuration(65), '1h 05 min')
  assert.equal(orderWorkflow.formatElapsedDuration(347), '5h 47 min')
})

test('active kitchen tickets expose item summaries and associated notes without an expandable list', async () => {
  const orders = await read('./pages/Orders.jsx')
  const ticket = await read('./components/KitchenTicket.jsx')
  const notes = await read('./components/KitchenTicketNotes.jsx')
  assert.match(orders, /<KitchenTicket/)
  assert.match(ticket, /buildKitchenItemSummary/)
  assert.match(ticket, /KitchenTicketNotes/)
  assert.match(notes, /getKitchenItemNotes/)
  assert.doesNotMatch(orders, /expandedOrderIds|aria-expanded=|Ver itens|Ocultar itens/)
})

test('active kitchen ticket actions use two readable columns and full touch targets', async () => {
  const source = await readOptional('./order-operations-compact.css')
  assert.match(source, /\.kitchen-ticket-actions\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s)
  assert.match(source, /\.kitchen-ticket-actions \.button\s*\{[^}]*min-height:\s*var\(--mobile-touch-target\)[^}]*white-space:\s*normal/s)
})

test('sidebar theme picker is a visual three-option segmented control with icons', async () => {
  const sidebar = await read('./components/Sidebar.jsx')
  assert.doesNotMatch(sidebar, /<select/)
  assert.match(sidebar, /theme-segmented-control/)
  assert.match(sidebar, /aria-pressed=/)
  assert.match(sidebar, /icon:\s*'sun'/)
  assert.match(sidebar, /icon:\s*'moon'/)
  assert.match(sidebar, /icon:\s*'system'/)
  assert.match(sidebar, /<Icon name=\{option\.icon\}/)
})

test('desktop theme remains compact while mobile navigation owns logout and avoids horizontal menu scrolling', async () => {
  const themeCss = await read('./theme-controls.css')
  const sidebar = await read('./components/Sidebar.jsx')
  const mobileNavigation = await read('./components/MobileNavigation.jsx')
  const mobileCss = await read('./mobile-navigation.css')

  assert.match(themeCss, /\.theme-option\s*\{[^}]*flex-direction:\s*column/s)
  assert.doesNotMatch(sidebar, /sidebar-mobile-logout/)
  assert.doesNotMatch(themeCss, /overflow-x:\s*auto/)
  assert.match(mobileNavigation, /Sair do sistema/)
  assert.match(mobileNavigation, /BottomSheet/)
  assert.match(mobileCss, /\.app-shell\s*>\s*\.sidebar\s*\{[^}]*display:\s*none/s)
  assert.match(mobileCss, /\.mobile-bottom-nav[\s\S]*position:\s*fixed/s)
})
