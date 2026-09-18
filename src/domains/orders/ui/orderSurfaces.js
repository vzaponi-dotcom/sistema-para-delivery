import React from 'react'

const loadOrders = () => {
  const modules = import.meta.glob('./Orders.jsx', { eager: true })
  return modules['./Orders.jsx']?.default
}

const loadOrderHistory = () => {
  const modules = import.meta.glob('./OrderHistory.jsx', { eager: true })
  return modules['./OrderHistory.jsx']?.default
}

export function Orders(props) {
  const Component = loadOrders()
  return React.createElement(Component, props)
}

export function OrderHistory(props) {
  const Component = loadOrderHistory()
  return React.createElement(Component, props)
}
