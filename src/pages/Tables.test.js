import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('Tables is an App-controlled workspace with no direct API access', async () => {
  const page = await read('./Tables.jsx')

  assert.match(page, /function Tables\(\{ tables, disabled, onCreate, onRename, onSetActive, onReorder, onTransfer \}\)/)
  assert.doesNotMatch(page, /fetch\s*\(/)
  assert.doesNotMatch(page, /\/api\/tables/)
})

test('Tables keeps official ordering and separates operational and configuration states', async () => {
  const page = await read('./Tables.jsx')

  assert.match(page, /\[\.\.\.tables\]\.sort\(\(left, right\) => left\.sortOrder - right\.sortOrder\)/)
  assert.match(page, /table\.isActive \? 'Ativa' : 'Inativa'/)
  assert.match(page, /const occupied = table\.occupancy === 'occupied'/)
  assert.match(page, /\{occupied \? 'Ocupada' : 'Livre'\}/)
  assert.doesNotMatch(page, /tables\.filter\([^)]*isActive/)
})

test('Tables provides creation, free-table rename, accessible reordering and confirmed deactivation', async () => {
  const page = await read('./Tables.jsx')

  assert.match(page, /Nova mesa/)
  assert.match(page, /Renomear mesa/)
  assert.match(page, /Mover .* para cima/)
  assert.match(page, /Mover .* para baixo/)
  assert.match(page, /Confirmar desativaçã[oã]/)
  assert.match(page, /onSetActive\(deactivatingTable\.id, false\)/)
  assert.match(page, /Reativar mesa/)
  assert.doesNotMatch(page, /Excluir mesa/)
})

test('occupied tables explain their restrictions and use a single confirmed transfer flow', async () => {
  const page = await read('./Tables.jsx')
  const transferDialog = await read('../components/TableTransferDialog.jsx')

  assert.match(page, /Feche ou transfira a comanda antes de renomear\/desativar\./)
  assert.match(page, /Transferir comanda/)
  assert.match(transferDialog, /table\.isActive && table\.occupancy === 'free' && table\.id !== sourceTable\.id/)
  assert.match(transferDialog, /Transferir \$\{sourceTable\.name\} → \$\{destination\.name\}\?/)
  assert.match(transferDialog, /onTransfer\(sourceTable\.id, destination\.id\)/)
})

test('table management styling remains theme-token based and mobile-safe', async () => {
  const css = await read('../table-management.css')

  assert.match(css, /var\(--surface\)/)
  assert.match(css, /var\(--text\)/)
  assert.match(css, /@media\s*\(max-width:\s*640px\)/)
  assert.match(css, /min-width:\s*0/)
})
