import fs from 'node:fs'

const path = 'src/App.jsx'
let source = fs.readFileSync(path, 'utf8')

const replaceOnce = (from, to, label) => {
  const first = source.indexOf(from)
  if (first === -1) throw new Error(`Missing App.jsx fragment: ${label}`)
  if (source.indexOf(from, first + from.length) !== -1) throw new Error(`Duplicate App.jsx fragment: ${label}`)
  source = source.replace(from, to)
}

replaceOnce(
  "import './client-duplicate.css'\n",
  "import './client-duplicate.css'\nimport './product-form.css'\n",
  'product form stylesheet import',
)

replaceOnce(
  "import Modal from './components/Modal'\n",
  "import Modal from './components/Modal'\nimport ProductForm from './components/ProductForm'\n",
  'ProductForm import',
)

replaceOnce(
  "import { findClientDuplicates } from '../shared/clientIdentity.js'\nimport { formatBRLCurrencyInput, formatBRLCurrencyValue, formatPhone, parseBRLCurrencyInput } from './utils/formFormatting.js'\n",
  "import { findClientDuplicates } from '../shared/clientIdentity.js'\nimport { categoryForUi } from '../shared/productCatalog.js'\nimport { formatBRLCurrencyValue, formatPhone, parseBRLCurrencyInput } from './utils/formFormatting.js'\n",
  'catalog helper import',
)

replaceOnce(
  "const PRODUCT_CATEGORY_OPTIONS = ['Marmita', 'Bebida', 'Doce', 'Adicional']\n  .map((value) => ({ value, label: value }))\n",
  '',
  'legacy category options',
)

replaceOnce(
  "const emptyProduct = () => ({ category: 'Marmita', size: 'P', name: '', price: formatBRLCurrencyValue(32) })",
  "const emptyProduct = () => ({\n  category: 'Refeições',\n  presentationType: 'size',\n  presentationValue: 'P',\n  presentationUnit: '',\n  name: '',\n  price: formatBRLCurrencyValue(32),\n})",
  'empty product model',
)

replaceOnce(
  "  const filteredProducts = useMemo(() => {\n    const normalizedSearch = productSearch.trim().toLowerCase()\n    if (!normalizedSearch) return products\n    return products.filter((product) => [product.name, product.category, product.size, String(product.price)].join(' ').toLowerCase().includes(normalizedSearch))\n  }, [productSearch, products])\n\n",
  '',
  'App product filter',
)

replaceOnce(
  "  const handleEditProduct = (product) => {\n    if (writesBlocked) return\n    setEditingProductId(product.id)\n    setShowProductForm(true)\n    setNewProduct({ category: product.category, size: product.size, name: product.name, price: formatBRLCurrencyValue(product.price) })\n  }\n\n  const productPayload = () => ({ category: newProduct.category, size: newProduct.size || 'Un', name: newProduct.name.trim(), price: parseBRLCurrencyInput(newProduct.price) })",
  "  const handleEditProduct = (product) => {\n    if (writesBlocked) return\n    setEditingProductId(product.id)\n    setShowProductForm(true)\n    const legacySized = Boolean(product.size && !['Un', 'Unidade'].includes(product.size))\n    setNewProduct({\n      category: categoryForUi(product.category),\n      presentationType: product.presentationType || (legacySized ? 'size' : 'unit'),\n      presentationValue: product.presentationValue ?? (legacySized ? product.size : ''),\n      presentationUnit: product.presentationUnit || '',\n      name: product.name,\n      price: formatBRLCurrencyValue(product.price),\n    })\n  }\n\n  const productPayload = () => ({\n    category: newProduct.category,\n    presentationType: newProduct.presentationType,\n    presentationValue: newProduct.presentationValue,\n    presentationUnit: newProduct.presentationUnit,\n    name: newProduct.name.trim(),\n    price: parseBRLCurrencyInput(newProduct.price),\n  })",
  'product edit and payload',
)

replaceOnce(
  "        {activeTab === 'products' && <Products products={filteredProducts} search={productSearch} currency={currency} onSearchChange={setProductSearch} onAdd={openNewProduct} onEdit={handleEditProduct} onDelete={handleDeleteProduct} />}",
  "        {activeTab === 'products' && <Products products={products} search={productSearch} currency={currency} onSearchChange={setProductSearch} onAdd={openNewProduct} onEdit={handleEditProduct} onDelete={handleDeleteProduct} />}",
  'Products raw collection wiring',
)

replaceOnce(
  `        {showProductForm && (\n          <Modal title={editingProductId !== null ? 'Editar produto' : 'Novo produto'} onClose={handleCancelProductEdit}>\n            <div className="form-stack">\n              <label className="form-field"><span>Nome do produto</span><input type="text" placeholder="Ex: Marmita executiva" value={newProduct.name} onChange={(event) => setNewProduct((current) => ({ ...current, name: event.target.value }))} /></label>\n              <div className="form-grid two-columns"><div className="form-field"><span>Categoria</span><SystemSelect value={newProduct.category} options={PRODUCT_CATEGORY_OPTIONS} onChange={(category) => setNewProduct((current) => ({ ...current, category }))} disabled={writesBlocked} label="Categoria do produto" /></div><label className="form-field"><span>Tamanho / unidade</span><input type="text" placeholder="Ex: M, 600ml, Un" value={newProduct.size} onChange={(event) => setNewProduct((current) => ({ ...current, size: event.target.value }))} /></label></div>\n              <label className="form-field"><span>Preço</span><input type="text" inputMode="decimal" placeholder="R$ 0,00" value={newProduct.price} onChange={(event) => setNewProduct((current) => ({ ...current, price: formatBRLCurrencyInput(event.target.value) }))} /></label>\n              <div className="form-actions"><Button type="button" variant="secondary" onClick={handleCancelProductEdit}>Cancelar</Button><Button type="button" disabled={writesBlocked || !newProduct.name.trim()} onClick={handleAddProduct}>{editingProductId !== null ? 'Salvar alterações' : 'Adicionar produto'}</Button></div>\n            </div>\n          </Modal>\n        )}`,
  `        {showProductForm && (\n          <Modal title={editingProductId !== null ? 'Editar produto' : 'Novo produto'} onClose={handleCancelProductEdit}>\n            <ProductForm\n              value={newProduct}\n              onChange={setNewProduct}\n              onSubmit={handleAddProduct}\n              onCancel={handleCancelProductEdit}\n              disabled={writesBlocked}\n              editing={editingProductId !== null}\n            />\n          </Modal>\n        )}`,
  'product modal body',
)

fs.writeFileSync(path, source)
