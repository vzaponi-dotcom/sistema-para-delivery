import React from 'react'

const load = () => {
  const modules = import.meta.glob('./PrintQueue.jsx', { eager: true })
  return modules['./PrintQueue.jsx']?.default
}

export function PrintQueue(props) {
  const Component = load()
  return React.createElement(Component, props)
}
