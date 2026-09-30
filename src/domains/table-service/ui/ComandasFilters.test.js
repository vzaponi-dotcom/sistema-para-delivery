import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { workspaceHarness, workspaceTables, nodeText, buttonNamed } from '../../../test-support/renderWorkspace.js'

const reserve = { id: 'future', clientName: 'João Araújo', scheduledFor: '2026-10-10T23:00:00Z', itemCount: 2, totalCents: 99999 }
const occupied = workspaceTables.find((table) => table.occupancy === 'occupied')
const free = workspaceTables.find((table) => table.id === 'free')
const tables = [{ ...occupied, nextReservation: reserve }, { ...free, nextReservation: { ...reserve, id: 'other', clientName: 'Márcia' } }, { ...free, id: 'terrace', name: 'Terraço', sortOrder: 3 }, ...workspaceTables.filter((table) => !table.isActive)]
const list = (r) => r.root.findByProps({ 'aria-label': 'Mesas ativas' })
const rows = (r) => list(r).findAll((node) => node.type === 'button' && /comanda-table-button/.test(node.props.className || ''))
const search = (r) => r.root.findByProps({ 'aria-label': 'Buscar mesa, cliente ou comanda' })
const summary = (r) => nodeText(r.root.findByProps({ 'aria-label': 'Resumo do salão' }))

test('salon summary counts occupancy and reservations independently and excludes reserved totals', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Comandas } = await h.load('/src/domains/table-service/ui/Comandas.jsx')
  const r = await h.render(Comandas, { tables, currency: (value) => value.toFixed(2) })
  assert.match(summary(r), /Em atendimento1Livres agora2Com reserva2Em aberto nas comandas123.45/)
  const freeRow = rows(r).find((row) => nodeText(row).includes('Varanda'))
  assert.match(nodeText(freeRow), /Livre agora/)
  assert.equal(list(r).findAllByProps({ className: 'comanda-reservation-button' }).length, 2)
  await act(async () => r.update(React.createElement(Comandas, { tables: [{ ...occupied, openTableTab: null }] })))
  assert.match(summary(r), /Em aberto nas comandas—.*Resumo indisponível/)
})

test('occupancy filters combine with accent-insensitive table, customer and tab search', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Comandas } = await h.load('/src/domains/table-service/ui/Comandas.jsx')
  const r = await h.render(Comandas, { tables })
  await act(async () => buttonNamed(r.root, 'Reservas').props.onClick())
  assert.equal(rows(r).length, 2)
  await act(async () => search(r).props.onChange({ target: { value: ' joao araujo ' } }))
  assert.equal(rows(r).length, 1)
  assert.match(nodeText(rows(r)[0]), /Mesa 7/)
  await act(async () => buttonNamed(r.root, 'Livres').props.onClick())
  assert.equal(rows(r).length, 0)
  assert.match(nodeText(list(r)), /Nenhuma mesa encontrada/)
  await act(async () => buttonNamed(r.root, 'Limpar busca e filtros').props.onClick())
  assert.equal(rows(r).length, 3)
  for (const query of ['terraco', '42']) {
    await act(async () => search(r).props.onChange({ target: { value: query } }))
    assert.equal(rows(r).length, 1)
  }
})

test('filtering retains controlled selection and never triggers order or payment actions', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Comandas } = await h.load('/src/domains/table-service/ui/Comandas.jsx')
  const intents = []
  const selection = { tableId: occupied.id, tableTabId: occupied.openTableTab.id }
  const r = await h.render(Comandas, { tables, selection, onSelectComanda: () => intents.push('select'), onAddOrder: () => intents.push('add'), onRequestPayment: () => intents.push('pay') })
  await act(async () => buttonNamed(r.root, 'Livres').props.onClick())
  assert.equal(rows(r).length, 2)
  assert.match(nodeText(r.root.findByProps({ 'aria-label': 'Detalhe da comanda' })), /Comanda 42.*Mesa 7/)
  assert.match(nodeText(r.root), /A mesa selecionada está fora do filtro/)
  assert.deepEqual(intents, [])
})

test('official refresh updates filtered rows and global counts without resetting the filter', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Comandas } = await h.load('/src/domains/table-service/ui/Comandas.jsx')
  const r = await h.render(Comandas, { tables })
  await act(async () => buttonNamed(r.root, 'Ocupadas').props.onClick())
  await act(async () => r.update(React.createElement(Comandas, { tables: tables.map((table) => table.id === occupied.id ? { ...table, occupancy: 'free', openTableTab: null } : table) })))
  assert.equal(rows(r).length, 0)
  assert.equal(buttonNamed(r.root, 'Ocupadas').props['aria-pressed'], true)
  assert.match(summary(r), /Em atendimento0Livres agora3Com reserva2/)
})

test('mobile detail starts at the top and returning restores the outer page position', async (t) => {
  const h = await workspaceHarness(t, { mobile: true })
  const { default: Comandas } = await h.load('/src/domains/table-service/ui/Comandas.jsx')
  h.window.scrollTo = ({ top }) => { h.window.scrollY = top }
  function Workspace() {
    const [selection, onSelectComanda] = React.useState(null)
    return React.createElement(Comandas, { tables, selection, onSelectComanda })
  }
  const r = await h.render(Workspace)
  h.window.scrollY = 320
  await act(async () => rows(r)[0].props.onClick())
  assert.equal(h.window.scrollY, 0, 'the back button and heading must be visible after opening')
  h.window.scrollY = 180
  await act(async () => buttonNamed(r.root, 'Voltar para mesas').props.onClick())
  assert.equal(h.window.scrollY, 320)
})
