import React from 'react'

const load = (path) => {
  const modules = import.meta.glob(['./PaymentSettings.jsx', './FinanceCategorySettings.jsx'], { eager: true })
  return modules[path]?.default
}

export function PaymentSettings(props) {
  const Component = load('./PaymentSettings.jsx')
  return React.createElement(Component, props)
}

export function FinanceCategorySettings(props) {
  const Component = load('./FinanceCategorySettings.jsx')
  return React.createElement(Component, props)
}
