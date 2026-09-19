import React from 'react'

const load = (path) => {
  const modules = import.meta.glob([
    './Products.jsx',
    './ProductForm.jsx',
  ], { eager: true })
  return modules[path]?.default
}

export function Products(props) {
  const Component = load('./Products.jsx')
  return React.createElement(Component, props)
}

export function ProductForm(props) {
  const Component = load('./ProductForm.jsx')
  return React.createElement(Component, props)
}
