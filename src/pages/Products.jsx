import { useRef, useState } from 'react'
import Button from '../components/Button'
import ConfirmationDialog from '../components/ConfirmationDialog'
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
const LONG_PRESS_MS = 550

function Products({ products, search, currency, onSearchChange, onAdd, onEdit, onDelete }) {
  const [pendingId, setPendingId] = useState(null)
  const [deleteCandidate, setDeleteCandidate] = useState(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('Todos')
  const [expandedCategories, setExpandedCategories] = useState(() => new Set())
  const [actionMenuProductId, setActionMenuProductId] = useState(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedProductIds, setSelectedProductIds] = useState(() => new Set())
  const longPressTimerRef = useRef(null)
  const longPressTriggeredRef = useRef(false)
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

  const groupedProducts = visibleProducts.reduce((groups, product) => {
    const category = categoryForUi(product.category)
    const current = groups.find((group) => group.category === category)
    if (current) current.products.push(product)
    else groups.push({ category, products: [product] })
    return groups
  }, [])

  const clearLongPress = () => {
    if (!longPressTimerRef.current) return
    clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = null
  }

  const toggleCategory = (category) => {
    setExpandedCategories((current) => {
      const next = new Set(current)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  const toggleProductSelection = (productId) => {
    setSelectedProductIds((current) => {
      const next = new Set(current)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  const enterSelectionMode = (productId = null) => {
    setSelectionMode(true)
    setActionMenuProductId(null)
    if (productId !== null) setSelectedProductIds((current) => new Set([...current, productId]))
  }

  const cancelSelection = () => {
    setSelectionMode(false)
    setSelectedProductIds(new Set())
    setBulkDeleteOpen(false)
  }

  const handleLongPressStart = (productId, event) => {
    if (actionsDisabled || selectionMode || event.pointerType === 'mouse') return
    clearLongPress()
    longPressTriggeredRef.current = false
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null
      longPressTriggeredRef.current = true
      enterSelectionMode(productId)
    }, LONG_PRESS_MS)
  }

  const handleRowClick = (productId) => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false
      return
    }
    if (selectionMode) toggleProductSelection(productId)
  }

  const handleDelete = async () => {
    if (actionsDisabled || !deleteCandidate) return
    const productId = deleteCandidate.id
    setPendingId(productId)
    try {
      await onDelete(productId)
      setDeleteCandidate(null)
    } finally {
      setPendingId(null)
    }
  }

  const handleBulkDelete = async () => {
    if (actionsDisabled || !selectedProductIds.size) return
    setPendingId('bulk')
    try {
      for (const productId of selectedProductIds) await onDelete(productId)
      cancelSelection()
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
            <input type="search" placeholder="Buscar produto, categoria, apresentação ou preço" value={search} onChange={(event) => onSearchChange(event.target.value)} />
          </label>
          <div className="product-category-filter"><SystemSelect value={categoryFilter} options={CATEGORY_FILTER_OPTIONS} onChange={setCategoryFilter} label="Filtrar categoria" /></div>
          <div className="product-toolbar-meta">
            <span className="toolbar-count">{visibleProducts.length} produto(s)</span>
            {!selectionMode && <button type="button" className="product-select-mode-button" onClick={() => enterSelectionMode()} disabled={actionsDisabled || !visibleProducts.length}>Selecionar</button>}
          </div>
        </div>

        {selectionMode && (
          <div className="product-selection-toolbar" aria-live="polite">
            <strong>{selectedProductIds.size} selecionado(s)</strong>
            <div>
              <button type="button" className="product-bulk-delete" onClick={() => setBulkDeleteOpen(true)} disabled={actionsDisabled || !selectedProductIds.size}>Excluir selecionados</button>
              <button type="button" className="product-selection-cancel" onClick={cancelSelection} disabled={actionsDisabled}>Cancelar seleção</button>
            </div>
          </div>
        )}

        <div className="product-list product-accordion-list">
          {groupedProducts.map(({ category, products: categoryProducts }) => {
            const expanded = Boolean(normalizedSearch) || categoryFilter !== 'Todos' || expandedCategories.has(category)
            return (
              <section className="product-category-accordion" key={category}>
                <button type="button" className="product-category-accordion-header" aria-expanded={expanded} onClick={() => toggleCategory(category)}>
                  <span className="product-category-accordion-icon"><Icon name={CATEGORY_ICON_NAMES[category]} size={19} /></span>
                  <span className="product-category-accordion-copy"><strong>{category}</strong><small>{categoryProducts.length} produto(s)</small></span>
                  <span className={expanded ? 'product-category-chevron expanded' : 'product-category-chevron'} aria-hidden="true">›</span>
                </button>

                {expanded && (
                  <div className="product-category-items">
                    {categoryProducts.map((product) => {
                      const selected = selectedProductIds.has(product.id)
                      const menuOpen = actionMenuProductId === product.id && !selectionMode
                      return (
                        <article
                          className={selected ? 'product-compact-row selected' : 'product-compact-row'}
                          key={product.id}
                          onPointerDown={(event) => handleLongPressStart(product.id, event)}
                          onPointerUp={clearLongPress}
                          onPointerCancel={clearLongPress}
                          onPointerLeave={clearLongPress}
                          onClick={() => handleRowClick(product.id)}
                        >
                          {selectionMode ? (
                            <button
                              type="button"
                              className={selected ? 'product-select-checkbox selected' : 'product-select-checkbox'}
                              aria-label={`${selected ? 'Desmarcar' : 'Selecionar'} ${product.name}`}
                              aria-pressed={selected}
                              onClick={(event) => { event.stopPropagation(); toggleProductSelection(product.id) }}
                              disabled={actionsDisabled}
                            >
                              {selected && <Icon name="check" size={15} />}
                            </button>
                          ) : (
                            <div className="product-icon"><Icon name={CATEGORY_ICON_NAMES[category]} size={18} /></div>
                          )}

                          <div className="product-compact-main">
                            <strong>{product.name}</strong>
                            <small>{formatProductPresentation(product)}</small>
                          </div>
                          <strong className="product-compact-price">{currency(product.price)}</strong>

                          {!selectionMode && (
                            <button
                              type="button"
                              className="product-overflow-button"
                              aria-label={`Ações de ${product.name}`}
                              aria-expanded={menuOpen}
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={(event) => {
                                event.stopPropagation()
                                setActionMenuProductId((current) => current === product.id ? null : product.id)
                              }}
                              disabled={actionsDisabled}
                            >⋮</button>
                          )}

                          {menuOpen && (
                            <div className="product-item-menu" onClick={(event) => event.stopPropagation()}>
                              <button type="button" onClick={() => { setActionMenuProductId(null); onEdit(product) }} disabled={actionsDisabled}><Icon name="edit" size={16} />Editar</button>
                              <button type="button" className="danger" onClick={() => { setActionMenuProductId(null); setDeleteCandidate(product) }} disabled={actionsDisabled}><Icon name="trash" size={16} />Excluir</button>
                            </div>
                          )}
                        </article>
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })}
        </div>

        {!visibleProducts.length && <div className="empty-state"><Icon name="products" size={28} /><strong>Nenhum produto encontrado</strong><span>Adicione um item ao cardápio ou ajuste a busca e os filtros.</span></div>}
      </section>

      {deleteCandidate && (
        <ConfirmationDialog
          title="Confirmar exclusão"
          message={`Excluir ${deleteCandidate.name}? Esta ação remove o produto do cardápio e não pode ser desfeita.`}
          confirmLabel="Confirmar exclusão"
          onClose={() => setDeleteCandidate(null)}
          onConfirm={handleDelete}
          disabled={actionsDisabled}
        />
      )}

      {bulkDeleteOpen && (
        <ConfirmationDialog
          title="Excluir produtos selecionados?"
          message={`Excluir ${selectedProductIds.size} produto(s)? Esta ação remove os itens do cardápio e não pode ser desfeita.`}
          confirmLabel="Excluir selecionados"
          onClose={() => setBulkDeleteOpen(false)}
          onConfirm={handleBulkDelete}
          disabled={actionsDisabled}
        />
      )}
    </>
  )
}

export default Products
