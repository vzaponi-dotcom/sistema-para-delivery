import NewOrder from './NewOrder'

export const tableTabsFromBootstrap = (bootstrap) => Array.isArray(bootstrap?.tableTabs) ? bootstrap.tableTabs : []

export function NewOrderRoute({ NewOrderComponent = NewOrder, ...newOrderProps }) {
  return <NewOrderComponent {...newOrderProps} />
}
