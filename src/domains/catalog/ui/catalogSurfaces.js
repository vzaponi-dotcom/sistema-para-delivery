import React from 'react'

const load = (path) => {
  const modules = import.meta.glob('./CatalogWorkspace.jsx', { eager: true })
  return modules[path]?.default
}

export function CatalogWorkspace(props) {
  const Component = load('./CatalogWorkspace.jsx')
  return React.createElement(Component, props)
}
