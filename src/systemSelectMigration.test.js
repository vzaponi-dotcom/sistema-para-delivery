import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const srcDir = dirname(fileURLToPath(import.meta.url))

const collectJsxFiles = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...await collectJsxFiles(fullPath))
    else if (entry.isFile() && entry.name.endsWith('.jsx')) files.push(fullPath)
  }
  return files
}

test('all app-facing JSX uses SystemSelect instead of native select', async () => {
  const files = await collectJsxFiles(srcDir)
  const offenders = []
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    if (/<select\b/.test(source)) offenders.push(file.slice(srcDir.length + 1))
  }
  assert.deepEqual(offenders, [])
})

test('App and Clients use the shared SystemSelect', async () => {
  const app = await readFile(join(srcDir, 'App.jsx'), 'utf8')
  const clients = await readFile(join(srcDir, 'pages/Clients.jsx'), 'utf8')
  assert.match(app, /import SystemSelect/)
  assert.match(clients, /import SystemSelect/)
})

test('App write selectors preserve blocked state and approved labels', async () => {
  const app = await readFile(join(srcDir, 'App.jsx'), 'utf8')
  const lines = app.split('\n')
  for (const label of ['Forma de pagamento', 'Tipo da movimentação', 'Categoria da movimentação']) {
    const selectorLine = lines.find((line) => line.includes('<SystemSelect') && line.includes(`label="${label}"`))
    assert.ok(selectorLine, `missing SystemSelect for ${label}`)
    assert.match(selectorLine, /disabled=\{writesBlocked\}/)
  }

  const productForm = await readFile(join(srcDir, 'components/ProductForm.jsx'), 'utf8')
  assert.match(productForm, /product-category-grid/)
  assert.match(productForm, /disabled=\{disabled\}/)
})
