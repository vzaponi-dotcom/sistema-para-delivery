import { useState } from 'react'
import Button from '../components/Button'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import SystemSelect from '../components/SystemSelect'
import {
  CATEGORY_ICON_NAMES,
  PRODUCT_CATEGORY_OPTIONS,
  categoryForUi,
  formatProductPresentation,
} from '../../shared/productCatalog.js'

const CATEGORY_FILTER_OPTIONS = [{ value: 'Todos', label: 'Todos' }, ...PRODUCT_CATEGORY_OPTIONS]

function Products({ products, search, currency, onSearchChange, onAdd, onEdit, onDelete }) {
  const [pendingId, setPendingId] = useState(null)
  const [categoryFilter, setCategoryFilter] = useState('Todos')
  const writeDisabled = typeof navigator !== 'undefined' && !navigator.onLine
  const actionsDisabled = writeDisabled || pendingId !== null

  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR')
  const visibleProducts = products.filter((product) => {
    const uiCategory = categoryForUi(product.category)
    const categoryMatch = categoryFilter === 'Todos' || uiCategory === categoryFilter
    const searchText = [product.name, uiCategory, formatProductPresentation(product), String(product.price)]
      .join(' ')
      .toLocaleLowerCase('pt-BR')
    return categoryMatch && (!normalizedSearch || searchText.includes(normalizedSearch))
  })

  const handleDelete = async (productId) => {
    if (actionsDisabled) return
    setPendingId(productId)
    try {
      await onDelete(productId)
    } finally {
      setPendingId(null)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Cardápio"
        title="Produtos e preços"
        description="Mantenha seu cardápio organizado e os valores sempre atualizados."
        actions={<Button icon="plus" onClick={onAdd} disabled={actionsDisabled}>Adicionar produto</Button>}
      />

      <section className="surface-card">
        <div className="toolbar product-toolbar">
          <label className="search-control">
            <Icon name="search" size={18} />
            <input
              type="search"
              placeholder="Buscar produto, categoria, apresentação ou preço"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </label>
          <div className="product-category-filter">
            <SystemSelect
              value={categoryFilter}
              options={CATEGORY_FILTER_OPTIONS}
              onChange={setCategoryFilter}
              label="Filtrar categoria"
            />
          </div>
          <span className="toolbar-count">{visibleProducts.length} produto(s)</span>
        </div>

        <div className="product-list">
          {visibleProducts.map((product) => {
            const uiCategory = categoryForUi(product.category)
            return (
              <article className="product-row" key={product.id}>
                <div className="product-icon"><Icon name={CATEGORY_ICON_NAMES[uiCategory]} size={19} /></div>
                <div className="product-main">
                  <span className="product-tag">{uiCategory}</span>
                  <strong>{product.name}</strong>
                  <small>{formatProductPresentation(product)}</small>
                </div>
                <div className="product-price">
                  <span>Preço</span>
                  <strong>{currency(product.price)}</strong>
                </div>
                <div className="entity-actions">
                  <button type="button" className="icon-button icon-button-neutral" aria-label={`Editar ${product.name}`} title="Editar produto" onClick={() => onEdit(product)} disabled={actionsDisabled}>
                    <Icon name="edit" size={17} />
                  </button>
                  <button type="button" className="icon-button icon-button-danger" aria-label={`Excluir ${product.name}`} title="Excluir produto" onClick={() => handleDelete(product.id)} disabled={actionsDisabled}>
                    <Icon name="trash" size={17} />
                  </button>
                </div>
              </article>
            )
          })}
        </div>

        {!visibleProducts.length && (
          <div className="empty-state">
            <Icon name="products" size={28} />
            <strong>Nenhum produto encontrado</strong>
            <span>Adicione um item ao cardápio ou ajuste a busca e os filtros.</span>
          </div>
        )}
      </section>
    </>
  )
}

export default Products
