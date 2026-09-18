import React from 'react'

const load = (path) => {
  const modules = import.meta.glob(['./FinanceWorkspace.jsx'], { eager: true })
  return modules[path]?.default
}

export function FinanceWorkspace(props) {
  const Component = load('./FinanceWorkspace.jsx')
  return React.createElement(Component, props)
}
