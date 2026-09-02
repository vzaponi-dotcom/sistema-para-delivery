import { createContext, useContext } from 'react'

export const DashboardPeriodContext = createContext(null)

export const useDashboardPeriod = () => {
  const value = useContext(DashboardPeriodContext)
  if (!value) throw new Error('useDashboardPeriod must be used within DashboardPeriodProvider')
  return value
}
