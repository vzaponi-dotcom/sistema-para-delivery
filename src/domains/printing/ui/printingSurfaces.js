import React from 'react'

const loadPrintQueue = () => {
  const modules = import.meta.glob('./PrintQueue.jsx', { eager: true })
  return modules['./PrintQueue.jsx']?.default
}

const loadPrintingSettingsContent = () => {
  const modules = import.meta.glob('./PrintingSettingsContent.jsx', { eager: true })
  return modules['./PrintingSettingsContent.jsx']?.default
}

export function PrintQueue(props) {
  const Component = loadPrintQueue()
  return React.createElement(Component, props)
}

export function PrintingSettingsContent(props) {
  const Component = loadPrintingSettingsContent()
  return React.createElement(Component, props)
}
