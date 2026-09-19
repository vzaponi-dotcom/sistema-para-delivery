import { categoryForUi } from './catalogPresentation.js'
import { formatProductPresentation } from '../../../../shared/productCatalog.js'

export function projectCatalogList(products, { search = '', categoryFilter = 'Todos' } = {}) {
  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR')
  const visibleProducts = products.filter((product) => {
    const category = categoryForUi(product.category)
    const text = [product.name, category, formatProductPresentation(product), String(product.price)]
      .join(' ')
      .toLocaleLowerCase('pt-BR')
    return (categoryFilter === 'Todos' || category === categoryFilter)
      && (!normalizedSearch || text.includes(normalizedSearch))
  })

  const groupedProducts = visibleProducts.reduce((groups, product) => {
    const category = categoryForUi(product.category)
    const group = groups.find((item) => item.category === category)
    if (group) group.products.push(product)
    else groups.push({ category, products: [product] })
    return groups
  }, [])

  return { normalizedSearch, visibleProducts, groupedProducts }
}
