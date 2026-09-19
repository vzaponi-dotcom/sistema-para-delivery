import React from 'react'

const load = (path) => {
  const modules = import.meta.glob(['./Clients.jsx'], { eager: true })
  return modules[path]?.default
}

export function Clients(props) {
  const Component = load('./Clients.jsx')
  return React.createElement(Component, props)
}
