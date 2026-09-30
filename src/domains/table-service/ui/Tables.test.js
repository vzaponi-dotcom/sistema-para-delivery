import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('Tables is an App-controlled workspace with no direct API access', async () => {
  const page = await read('./Tables.jsx')

  assert.match(page, /function Tables\(\{ tables, disabled, canOpenComanda = false, canManageTables = true, onCreate, onRename, onSetActive, onReorder, onOpenComanda \}\)/)
  assert.doesNotMatch(page, /fetch\s*\(/)
  assert.doesNotMatch(page, /\/api\/tables/)
})

test('Tables keeps official ordering and separates operational and configuration states', async () => {
  const page = await read('./Tables.jsx')

  assert.match(page, /\[\.\.\.tables\]\.sort\(\(left, right\) => left\.sortOrder - right\.sortOrder\)/)
  assert.match(page, /!table\.isActive \? 'Inativa' : occupied \? 'Ocupada' : 'Livre agora'/)
  assert.match(page, /const occupied = table\.occupancy === 'occupied'/)
  assert.match(page, /filter === 'all'/)
})

test('Tables provides creation, free-table rename, accessible reordering and confirmed deactivation', async () => {
  const page = await read('./Tables.jsx')

  assert.match(page, /Nova mesa/)
  assert.match(page, /onEdit=\{beginRename\}/)
  assert.match(page, /Mover .* para cima/)
  assert.match(page, /Mover .* para baixo/)
  assert.match(page, /Confirmar desativaçã[oã]/)
  assert.match(page, /onSetActive\(deactivatingTable\.id, false\)/)
  assert.match(page, /onSetActive\(id, true\)/)
  assert.doesNotMatch(page, /Excluir mesa/)
})

test('occupied tables explain their restrictions and link to the exact comanda identity', async () => {
  const page = await read('./Tables.jsx')

  assert.match(page, /Feche a comanda antes de renomear\/desativar\./)
  assert.match(page, /Ver comanda/)
  assert.match(page, /onOpenComanda\?\.\(\{ tableId: table\.id, tableTabId: table\.openTableTab\.id \}\)/)
  assert.doesNotMatch(page, /TableTransferDialog|Transferir comanda/)
})

test('table management styling remains theme-token based and mobile-safe', async () => {
  const css = await read('../../../table-management.css')

  assert.match(css, /var\(--surface\)/)
  assert.match(css, /var\(--text\)/)
  assert.match(css, /@media\s*\(max-width:\s*640px\)/)
  assert.match(css, /min-width:\s*0/)
})


test('reserved tables explain the active reservation restriction without hiding current occupancy', async () => {
  const page = await read('./Tables.jsx')

  assert.match(page, /table\.nextReservation/)
  assert.match(page, /table-management-reservation/)
  assert.match(page, /Mova ou cancele a reserva antes de renomear\/desativar\./)
  assert.match(page, /disabled=\{locked \|\| Boolean\(reason\)\}/)
  assert.match(page, /occupied \? 'Ocupada' : 'Livre agora'/)
  assert.match(page, /onMove\(table\.id, index - 1\)/)
  assert.match(page, /onMove\(table\.id, index \+ 1\)/)
})
