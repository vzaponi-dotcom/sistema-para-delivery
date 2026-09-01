import Button from '../components/Button'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'

function Products({ products, search, currency, onSearchChange, onAdd, onEdit, onDelete }) {
  return (
    <>
      <PageHeader
        eyebrow="Cardápio"
        title="Produtos e preços"
        description="Mantenha seu cardápio organizado e os valores sempre atualizados."
        actions={<Button icon="plus" onClick={onAdd}>Adicionar produto</Button>}
      />

      <section className="surface-card">
        <div className="toolbar">
          <label className="search-control">
            <Icon name="search" size={18} />
            <input
              type="search"
              placeholder="Buscar produto, categoria, tamanho ou preço"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </label>
          <span className="toolbar-count">{products.length} produto(s)</span>
        </div>

        <div className="product-list">
          {products.map((product) => (
            <article className="product-row" key={product.id}>
              <div className="product-icon"><Icon name="package" size={19} /></div>
              <div className="product-main">
                <span className="product-tag">{product.category}</span>
                <strong>{product.name}</strong>
                <small>{product.size || 'Unidade'}</small>
              </div>
              <div className="product-price">
                <span>Preço</span>
                <strong>{currency(product.price)}</strong>
              </div>
              <div className="entity-actions">
                <button type="button" className="icon-button icon-button-neutral" aria-label={`Editar ${product.name}`} title="Editar produto" onClick={() => onEdit(product)}>
                  <Icon name="edit" size={17} />
                </button>
                <button type="button" className="icon-button icon-button-danger" aria-label={`Excluir ${product.name}`} title="Excluir produto" onClick={() => onDelete(product.id)}>
                  <Icon name="trash" size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>

        {!products.length && (
          <div className="empty-state">
            <Icon name="products" size={28} />
            <strong>Nenhum produto encontrado</strong>
            <span>Adicione um item ao cardápio ou ajuste a busca.</span>
          </div>
        )}
      </section>
    </>
  )
}

export default Products
