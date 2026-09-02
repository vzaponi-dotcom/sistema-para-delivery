import { useEffect, useMemo, useState } from 'react'
import Button from './Button'

function OrderProductCatalog({ products, currency, disabled = false, onAdd }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Todos')
  const [addedProductId, setAddedProductId] = useState(null)

  const categories = useMemo(
    () => ['Todos', ...new Set(products.map((product) => product.category).filter(Boolean))],
    [products],
  )

  const visibleProducts = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    return products.filter((product) => (
      (category === 'Todos' || product.category === category) &&
      (!normalized || [product.name, product.category, product.size].join(' ').toLowerCase().includes(normalized))
    ))
  }, [category, products, search])

  useEffect(() => {
    if (!addedProductId) return undefined
    const timer = window.setTimeout(() => setAddedProductId(null), 1200)
    return () => window.clearTimeout(timer)
  }, [addedProductId])

  const addProduct = (product) => {
    onAdd(product)
    setAddedProductId(product.id)
  }

  return (
    <section className="surface-card new-order-catalog">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Catálogo</span>
          <h2>Adicionar produtos</h2>
        </div>
        <span className="toolbar-count">{visibleProducts.length} produto(s)</span>
      </div>

      <label className="form-field">
        <span>Buscar produto</span>
        <input
          type="search"
          placeholder="Nome, categoria ou tamanho"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>

      <div className="new-order-categories" aria-label="Categorias de produtos">
        {categories.map((item) => (
          <button
            key={item}
            type="button"
            className={category === item ? 'new-order-category active' : 'new-order-category'}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="new-order-products">
        {visibleProducts.map((product) => {
          const recentlyAdded = addedProductId === product.id
          return (
            <article className={recentlyAdded ? 'new-order-product recently-added' : 'new-order-product'} key={product.id}>
              <div>
                <strong>{product.name}</strong>
                <span>{[product.category, product.size].filter(Boolean).join(' · ')}</span>
              </div>
              <div className="new-order-product-action">
                <strong>{currency(product.price)}</strong>
                <Button
                  type="button"
                  className="new-order-add-button"
                  onClick={() => addProduct(product)}
                  disabled={disabled}
                  aria-live="polite"
                >
                  {recentlyAdded ? '✓ Adicionado' : 'Adicionar'}
                </Button>
              </div>
            </article>
          )
        })}

        {!visibleProducts.length && (
          <div className="empty-state compact">
            <strong>Nenhum produto encontrado</strong>
            <span>Ajuste a busca ou selecione outra categoria.</span>
          </div>
        )}
      </div>
    </section>
  )
}

export default OrderProductCatalog
