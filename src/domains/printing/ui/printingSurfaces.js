import React from 'react'

const loadPrintQueue = () => {
  const modules = import.meta.glob('./PrintQueue.jsx', { eager: true })
  return modules['./PrintQueue.jsx']?.default
}

const loadPrintingSettingsContent = () => {
  const modules = import.meta.glob('./PrintingSettingsContent.jsx', { eager: true })
  return modules['./PrintingSettingsContent.jsx']?.default
}

const loadPrintingOverlays = () => {
  const modules = import.meta.glob('./PrintingOverlays.jsx', { eager: true })
  return modules['./PrintingOverlays.jsx']?.default
}

const loadOrderTicketPreview = () => {
  const modules = import.meta.glob('./OrderTicketPreview.jsx', { eager: true })
  return modules['./OrderTicketPreview.jsx']?.default
}

const loadPrintStatusBadge = () => {
  const modules = import.meta.glob('./PrintStatusBadge.jsx', { eager: true })
  return modules['./PrintStatusBadge.jsx']?.default
}

const loadTableTabTicketPreview = () => {
  const modules = import.meta.glob('./TableTabTicketPreview.jsx', { eager: true })
  return modules['./TableTabTicketPreview.jsx']?.default
}

export function PrintQueue(props) {
  const Component = loadPrintQueue()
  return React.createElement(Component, props)
}

export function PrintingSettingsContent(props) {
  const Component = loadPrintingSettingsContent()
  return React.createElement(Component, props)
}

export function PrintingOverlays(props) {
  const Component = loadPrintingOverlays()
  return React.createElement(Component, props)
}

export function OrderTicketPreview(props) {
  const Component = loadOrderTicketPreview()
  return React.createElement(Component, props)
}

export function PrintStatusBadge(props) {
  const Component = loadPrintStatusBadge()
  return React.createElement(Component, props)
}

export function TableTabTicketPreview(props) {
  const Component = loadTableTabTicketPreview()
  return React.createElement(Component, props)
}
