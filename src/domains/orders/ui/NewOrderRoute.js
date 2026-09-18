import React from 'react'

export const tableTabsFromBootstrap = (bootstrap) => Array.isArray(bootstrap?.tableTabs) ? bootstrap.tableTabs : []

const loadDefaultNewOrder = () => {
  const modules = import.meta.glob('./NewOrder.jsx', { eager: true })
  return modules['./NewOrder.jsx']?.default
}

export function NewOrderRoute({ NewOrderComponent, ...newOrderProps }) {
  const Component = NewOrderComponent || loadDefaultNewOrder()
  return React.createElement(Component, newOrderProps)
}
