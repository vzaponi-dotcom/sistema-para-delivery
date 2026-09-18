import React from 'react'

const load = (path) => {
  const modules = import.meta.glob(['./Tables.jsx', './LocalTableSelector.jsx'], { eager: true })
  return modules[path]?.default
}

export function Tables(props) {
  const Component = load('./Tables.jsx')
  return React.createElement(Component, props)
}

export function LocalTableSelector(props) {
  const Component = load('./LocalTableSelector.jsx')
  return React.createElement(Component, props)
}
