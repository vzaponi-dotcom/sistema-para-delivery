import React from 'react'

const loadDefaultNewOrder = () => {
  const modules = import.meta.glob('./NewOrder.jsx', { eager: true })
  return modules['./NewOrder.jsx']?.default
}

export function NewOrderRoute({ NewOrderComponent, ...newOrderProps }) {
  const Component = NewOrderComponent || loadDefaultNewOrder()
  return React.createElement(Component, newOrderProps)
}
