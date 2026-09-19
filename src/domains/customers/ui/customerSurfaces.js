import React from 'react'

const load = (path) => {
  const modules = import.meta.glob([
    './Clients.jsx',
    './ClientDuplicateModal.jsx',
    './CustomerEditorDialog.jsx',
  ], { eager: true })
  return modules[path]?.default
}

export function Clients(props) {
  const Component = load('./Clients.jsx')
  return React.createElement(Component, props)
}

export function ClientDuplicateModal(props) {
  const Component = load('./ClientDuplicateModal.jsx')
  return React.createElement(Component, props)
}

export function CustomerEditorDialog(props) {
  const Component = load('./CustomerEditorDialog.jsx')
  return React.createElement(Component, props)
}
