import { useState } from 'react'
import { DashboardPeriodContext } from './dashboardPeriodContext.js'

export function DashboardPeriodProvider({ children }) {
  const [period, setPeriod] = useState('30d')

  return (
    <DashboardPeriodContext.Provider value={{ period, setPeriod }}>
      {children}
    </DashboardPeriodContext.Provider>
  )
}
