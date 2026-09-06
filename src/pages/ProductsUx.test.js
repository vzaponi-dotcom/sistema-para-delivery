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

  assert.match(products, /selectedProductIds/)
  assert.match(products, /selectionMode/)
  assert.match(products, />Selecionar</)
  assert.match(products, /onPointerDown=/)
  assert.match(products, /Excluir selecionados/)
  assert.match(products, /Cancelar seleção/)
  assert.match(products, /await onDelete\(productId\)/)
})

test('multi-select keeps a comfortable touch target while showing a compact selection marker', async () => {
  const products = await read('./Products.jsx')
  const css = await read('../product-form.css')

  assert.match(products, /product-select-checkbox-mark/)
  assert.match(css, /\.product-select-checkbox\s*\{[^}]*width:\s*44px[^}]*height:\s*44px[^}]*border:\s*0[^}]*background:\s*transparent/s)
  assert.match(css, /\.product-select-checkbox-mark\s*\{[^}]*width:\s*28px[^}]*height:\s*28px/s)
})

test('bulk selection actions stay accessible while scrolling on desktop', async () => {
  const css = await read('../product-selection.css')

  assert.match(css, /\.product-selection-toolbar\s*\{[^}]*position:\s*sticky[^}]*top:\s*12px[^}]*z-index:\s*30/s)
})

test('mobile bulk actions render through a body portal instead of inside the transformed page transition', async () => {
  const products = await read('./Products.jsx')
  const shell = await read('../components/AppShell.jsx')
  const css = await read('../product-selection.css')

  assert.match(shell, /className="app-content page-transition"/)
  assert.match(products, /import \{ createPortal \} from 'react-dom'/)
  assert.match(products, /createPortal\(/)
  assert.match(products, /product-selection-mobile-toolbar/)
  assert.match(products, /product-accordion-list has-selection-actions/)
  assert.match(css, /\.product-selection-mobile-toolbar\s*\{[^}]*display:\s*none/s)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.product-selection-toolbar\s*\{[^}]*display:\s*none/s)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.product-selection-mobile-toolbar\s*\{[^}]*display:\s*flex[^}]*position:\s*fixed[^}]*bottom:\s*calc\(76px \+ env\(safe-area-inset-bottom\)\)/s)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.product-accordion-list\.has-selection-actions\s*\{[^}]*padding-bottom:\s*96px/s)
})

test('product form uses option B segmented presentation control and horizontal size choices', async () => {
  const form = await read('../components/ProductForm.jsx')
  const css = await read('../product-form.css')

  assert.match(form, /product-presentation-segmented/)
  assert.match(form, /Escolha como este produto será apresentado no cardápio\./)
  assert.match(form, /product-size-scroll/)
  assert.match(css, /\.product-presentation-segmented\s*\{[^}]*display:\s*flex/s)
  assert.match(css, /\.product-size-scroll\s*\{[^}]*display:\s*flex[^}]*overflow-x:\s*auto/s)
  assert.doesNotMatch(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.product-presentation-segmented[^}]*grid-template-columns:\s*1fr/s)
})

test('volume and weight use compact horizontal unit segments instead of stacked full-width buttons', async () => {
  const form = await read('../components/ProductForm.jsx')
  const css = await read('../product-form.css')

  assert.match(form, /product-measure-unit-segmented/)
  assert.match(css, /\.product-measure-unit-segmented\s*\{[^}]*display:\s*flex[^}]*overflow:\s*hidden/s)
  assert.match(css, /\.product-measure-unit-segmented \.product-unit-option\s*\{[^}]*flex:\s*1\s+1\s+0/s)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.product-measure-unit-segmented\s*\{[^}]*display:\s*flex/s)
})
