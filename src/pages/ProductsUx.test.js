import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('products are rendered as category accordions with compact rows and per-item overflow actions', async () => {
  const products = await read('./Products.jsx')

  assert.match(products, /product-category-accordion/)
  assert.match(products, /aria-expanded=\{expanded\}/)
  assert.match(products, /product-compact-row/)
  assert.match(products, /Ações de \$\{product\.name\}/)
  assert.match(products, />⋮</)
})

test('products support explicit multi-select plus long press and bulk delete confirmation', async () => {
  const products = await read('./Products.jsx')
  const app = await read('../App.jsx')

  assert.match(products, /selectedProductIds/)
  assert.match(products, /selectionMode/)
  assert.match(products, />Selecionar</)
  assert.match(products, /onPointerDown=/)
  assert.match(products, /Excluir selecionados/)
  assert.match(products, /Cancelar seleção/)
  assert.match(products, /onDeleteMany/)
  assert.match(app, /const handleDeleteProducts = async/)
  assert.match(app, /onDeleteMany=\{handleDeleteProducts\}/)
})

test('product form uses option B segmented presentation control and horizontal size choices', async () => {
  const form = await read('../components/ProductForm.jsx')
  const css = await read('../product-form.css')

  assert.match(form, /product-presentation-segmented/)
  assert.match(form, /Escolha como este produto será apresentado no cardápio\./)
  assert.match(form, /product-size-scroll/)
  assert.match(css, /\.product-presentation-segmented\s*\{[^}]*display:\s*flex[^}]*overflow-x:\s*auto/s)
  assert.match(css, /\.product-size-scroll\s*\{[^}]*display:\s*flex[^}]*overflow-x:\s*auto/s)
  assert.doesNotMatch(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.product-presentation-segmented[^}]*grid-template-columns:\s*1fr/s)
})
